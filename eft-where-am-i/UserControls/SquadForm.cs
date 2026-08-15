using System.Net;
using System.Net.Sockets;
using eft_where_am_i.Classes;

namespace eft_where_am_i
{
    internal sealed class SquadForm : Form
    {
        private static readonly Color WindowColor = Color.FromArgb(24, 24, 22);
        private static readonly Color SurfaceColor = Color.FromArgb(35, 34, 30);
        private static readonly Color InputColor = Color.FromArgb(47, 45, 40);
        private static readonly Color BorderColor = Color.FromArgb(106, 96, 74);
        private static readonly Color AccentColor = Color.FromArgb(154, 136, 102);
        private static readonly Color AccentHoverColor = Color.FromArgb(177, 156, 116);
        private static readonly Color MutedColor = Color.FromArgb(169, 163, 150);
        private static readonly Color ConnectedColor = Color.FromArgb(112, 168, 0);

        private readonly SquadNetworkService service;
        private readonly TextBox nameBox = new();
        private readonly TextBox addressBox = new();
        private readonly NumericUpDown portBox = new();
        private readonly TextBox passwordBox = new();
        private readonly Button revealPasswordButton = new();
        private readonly Button hostModeButton = new();
        private readonly Button clientModeButton = new();
        private readonly Button connectButton = new();
        private readonly Button disconnectButton = new();
        private readonly Button copyEndpointButton = new();
        private readonly Label addressLabel = new();
        private readonly Label statusLabel = new();
        private readonly Label endpointLabel = new();
        private readonly Label memberCountLabel = new();
        private readonly ListBox participantList = new();
        private readonly bool korean;
        private bool hostMode = true;
        private bool busy;

        public SquadForm(SquadNetworkService service)
        {
            this.service = service;
            korean = string.Equals(
                SettingsHandler.Instance.GetSettings().language,
                "ko",
                StringComparison.OrdinalIgnoreCase);

            InitializeUi();
            LoadSavedValues();
            service.StatusChanged += OnStatusChanged;
            service.ParticipantsChanged += OnParticipantsChanged;
            FormClosing += (_, eventArgs) =>
            {
                if (eventArgs.CloseReason == CloseReason.UserClosing)
                {
                    eventArgs.Cancel = true;
                    Hide();
                }
            };
        }

        public void ShowOrActivate(IWin32Window owner)
        {
            RefreshState();
            if (Visible)
            {
                Activate();
                return;
            }
            Show(owner);
        }

        private void InitializeUi()
        {
            SuspendLayout();
            Text = T("Squad Multiplayer", "스쿼드 멀티플레이어");
            ClientSize = new Size(610, 590);
            MinimumSize = new Size(610, 590);
            StartPosition = FormStartPosition.CenterParent;
            BackColor = WindowColor;
            ForeColor = Color.FromArgb(232, 228, 218);
            Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;

            var root = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(20, 18, 20, 18),
                ColumnCount = 1,
                RowCount = 6,
                BackColor = WindowColor
            };
            root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 46));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 174));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 48));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 92));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            Controls.Add(root);

            root.Controls.Add(CreateHeader(), 0, 0);
            root.Controls.Add(CreateModeSelector(), 0, 1);
            root.Controls.Add(CreateConnectionFields(), 0, 2);
            root.Controls.Add(CreateActionBar(), 0, 3);
            root.Controls.Add(CreateStatusPanel(), 0, 4);
            root.Controls.Add(CreateMemberPanel(), 0, 5);

            ResumeLayout(true);
        }

        private Control CreateHeader()
        {
            var panel = new Panel { Dock = DockStyle.Fill, Margin = Padding.Empty };
            var title = new Label
            {
                AutoSize = true,
                Font = new Font(Font.FontFamily, 15F, FontStyle.Bold),
                ForeColor = Color.WhiteSmoke,
                Location = new Point(0, 0),
                Text = T("Squad multiplayer", "스쿼드 멀티플레이어")
            };
            var subtitle = new Label
            {
                AutoSize = true,
                ForeColor = MutedColor,
                Location = new Point(1, 31),
                Text = T(
                    "Share map positions through an encrypted host-client session.",
                    "암호화된 호스트-클라이언트 세션으로 지도 위치를 공유합니다.")
            };
            panel.Controls.Add(title);
            panel.Controls.Add(subtitle);
            return panel;
        }

        private Control CreateModeSelector()
        {
            var layout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 2,
                RowCount = 1,
                Margin = new Padding(0, 0, 0, 8)
            };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            ConfigureModeButton(hostModeButton, T("HOST A SQUAD", "스쿼드 호스트"));
            ConfigureModeButton(clientModeButton, T("JOIN A SQUAD", "스쿼드 참가"));
            hostModeButton.Margin = new Padding(0, 0, 4, 0);
            clientModeButton.Margin = new Padding(4, 0, 0, 0);
            hostModeButton.Click += (_, _) => SetMode(true, true);
            clientModeButton.Click += (_, _) => SetMode(false, true);
            layout.Controls.Add(hostModeButton, 0, 0);
            layout.Controls.Add(clientModeButton, 1, 0);
            return layout;
        }

        private Control CreateConnectionFields()
        {
            var layout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 2,
                RowCount = 4,
                Margin = new Padding(0, 0, 0, 8),
                Padding = new Padding(12, 8, 12, 8),
                BackColor = SurfaceColor
            };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 135));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            for (int row = 0; row < 4; row++)
            {
                layout.RowStyles.Add(new RowStyle(SizeType.Percent, 25));
            }

            ConfigureTextBox(nameBox);
            ConfigureTextBox(addressBox);
            ConfigureTextBox(passwordBox);
            nameBox.MaxLength = 24;
            passwordBox.UseSystemPasswordChar = true;
            passwordBox.MaxLength = 128;

            portBox.Minimum = 1024;
            portBox.Maximum = 65535;
            portBox.Value = 16243;
            portBox.Dock = DockStyle.Fill;
            portBox.BackColor = InputColor;
            portBox.ForeColor = Color.WhiteSmoke;
            portBox.BorderStyle = BorderStyle.FixedSingle;
            portBox.Margin = new Padding(0, 5, 0, 5);

            AddRow(layout, 0, CreateFieldLabel(T("Player name", "플레이어 이름")), nameBox);
            addressLabel.Text = T("Host address", "호스트 주소");
            StyleFieldLabel(addressLabel);
            AddRow(layout, 1, addressLabel, addressBox);
            AddRow(layout, 2, CreateFieldLabel(T("TCP port", "TCP 포트")), portBox);
            AddRow(layout, 3, CreateFieldLabel(T("Session password", "세션 비밀번호")), CreatePasswordField());
            return layout;
        }

        private Control CreatePasswordField()
        {
            var layout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 2,
                RowCount = 1,
                Margin = Padding.Empty
            };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 72));
            passwordBox.Margin = new Padding(0, 5, 6, 5);
            ConfigureSecondaryButton(revealPasswordButton, T("SHOW", "표시"));
            revealPasswordButton.Margin = new Padding(0, 5, 0, 5);
            revealPasswordButton.Click += (_, _) =>
            {
                passwordBox.UseSystemPasswordChar = !passwordBox.UseSystemPasswordChar;
                revealPasswordButton.Text = passwordBox.UseSystemPasswordChar
                    ? T("SHOW", "표시")
                    : T("HIDE", "숨김");
            };
            layout.Controls.Add(passwordBox, 0, 0);
            layout.Controls.Add(revealPasswordButton, 1, 0);
            return layout;
        }

        private Control CreateActionBar()
        {
            var layout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 3,
                RowCount = 1,
                Margin = new Padding(0, 0, 0, 8)
            };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 52));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 24));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 24));

            ConfigurePrimaryButton(connectButton);
            ConfigureSecondaryButton(disconnectButton, T("DISCONNECT", "연결 해제"));
            ConfigureSecondaryButton(copyEndpointButton, T("COPY ADDRESS", "주소 복사"));
            connectButton.Margin = new Padding(0, 0, 5, 0);
            disconnectButton.Margin = new Padding(5, 0, 5, 0);
            copyEndpointButton.Margin = new Padding(5, 0, 0, 0);
            connectButton.Click += async (_, _) => await ConnectAsync();
            disconnectButton.Click += (_, _) => service.Stop();
            copyEndpointButton.Click += (_, _) => CopyHostEndpoint();
            layout.Controls.Add(connectButton, 0, 0);
            layout.Controls.Add(disconnectButton, 1, 0);
            layout.Controls.Add(copyEndpointButton, 2, 0);
            return layout;
        }

        private Control CreateStatusPanel()
        {
            var layout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 2,
                RowCount = 2,
                Margin = new Padding(0, 0, 0, 8),
                Padding = new Padding(12, 10, 12, 8),
                BackColor = SurfaceColor
            };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 135));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 25));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

            statusLabel.AutoSize = true;
            statusLabel.Anchor = AnchorStyles.Left;
            statusLabel.Font = new Font(Font.FontFamily, 9F, FontStyle.Bold);
            endpointLabel.AutoEllipsis = true;
            endpointLabel.Dock = DockStyle.Fill;
            endpointLabel.ForeColor = MutedColor;
            endpointLabel.TextAlign = ContentAlignment.MiddleLeft;
            layout.Controls.Add(CreateFieldLabel(T("Status", "상태")), 0, 0);
            layout.Controls.Add(statusLabel, 1, 0);
            layout.Controls.Add(CreateFieldLabel(T("Connection", "연결 정보")), 0, 1);
            layout.Controls.Add(endpointLabel, 1, 1);
            return layout;
        }

        private Control CreateMemberPanel()
        {
            var layout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 2,
                Margin = Padding.Empty
            };
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 30));
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

            var header = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 2,
                RowCount = 1,
                Margin = Padding.Empty
            };
            header.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            header.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            var title = new Label
            {
                AutoSize = true,
                Anchor = AnchorStyles.Left,
                Font = new Font(Font.FontFamily, 9F, FontStyle.Bold),
                ForeColor = Color.Gainsboro,
                Text = T("SQUAD MEMBERS", "스쿼드 멤버")
            };
            memberCountLabel.AutoSize = true;
            memberCountLabel.Anchor = AnchorStyles.Right;
            memberCountLabel.ForeColor = MutedColor;
            header.Controls.Add(title, 0, 0);
            header.Controls.Add(memberCountLabel, 1, 0);

            participantList.Dock = DockStyle.Fill;
            participantList.BackColor = SurfaceColor;
            participantList.ForeColor = Color.WhiteSmoke;
            participantList.BorderStyle = BorderStyle.FixedSingle;
            participantList.IntegralHeight = false;
            participantList.ItemHeight = 20;
            layout.Controls.Add(header, 0, 0);
            layout.Controls.Add(participantList, 0, 1);
            return layout;
        }

        private async Task ConnectAsync()
        {
            if (!ValidateInputs()) return;
            SaveValues();
            SetBusy(true);
            try
            {
                if (hostMode)
                {
                    await service.StartHostAsync((int)portBox.Value, passwordBox.Text, nameBox.Text);
                }
                else
                {
                    await service.JoinAsync(addressBox.Text.Trim(), (int)portBox.Value, passwordBox.Text, nameBox.Text);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    this,
                    ex.Message,
                    hostMode ? T("Unable to host squad", "스쿼드 호스트 실패") : T("Unable to join squad", "스쿼드 참가 실패"),
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
            }
            finally
            {
                SetBusy(false);
                RefreshState();
            }
        }

        private bool ValidateInputs()
        {
            string? error = null;
            if (string.IsNullOrWhiteSpace(nameBox.Text))
            {
                error = T("Enter a player name.", "플레이어 이름을 입력하세요.");
            }
            else if (!hostMode && string.IsNullOrWhiteSpace(addressBox.Text))
            {
                error = T("Enter the host IP address or DNS name.", "호스트 IP 주소 또는 DNS 이름을 입력하세요.");
            }
            else if (passwordBox.Text.Length < 4)
            {
                error = T("The session password must contain at least 4 characters.", "세션 비밀번호는 4자 이상이어야 합니다.");
            }

            if (error == null) return true;
            MessageBox.Show(this, error, T("Check squad settings", "스쿼드 설정 확인"), MessageBoxButtons.OK, MessageBoxIcon.Information);
            return false;
        }

        private void LoadSavedValues()
        {
            AppSettings settings = SettingsHandler.Instance.GetSettings();
            nameBox.Text = string.IsNullOrWhiteSpace(settings.squad_name) ? Environment.UserName : settings.squad_name;
            addressBox.Text = string.IsNullOrWhiteSpace(settings.squad_host) ? "127.0.0.1" : settings.squad_host;
            portBox.Value = Math.Clamp(settings.squad_port, 1024, 65535);
            passwordBox.Text = SquadPasswordProtector.Unprotect(settings.squad_password_protected);
            SetMode(!string.Equals(settings.squad_mode, "client", StringComparison.OrdinalIgnoreCase), false);
            RefreshState();
        }

        private void SaveValues()
        {
            AppSettings settings = SettingsHandler.Instance.GetSettings();
            settings.squad_name = nameBox.Text.Trim();
            settings.squad_host = addressBox.Text.Trim();
            settings.squad_port = (int)portBox.Value;
            settings.squad_mode = hostMode ? "host" : "client";
            settings.squad_password_protected = SquadPasswordProtector.Protect(passwordBox.Text);
            SettingsHandler.Instance.UpdateSettings(settings);
        }

        private void SetMode(bool useHostMode, bool save)
        {
            if (service.IsConnected || busy) return;
            hostMode = useHostMode;
            if (save)
            {
                SettingsHandler.Instance.SetValue<string>(settings => settings.squad_mode = hostMode ? "host" : "client");
            }
            RefreshState();
        }

        private void SetBusy(bool value)
        {
            busy = value;
            UseWaitCursor = value;
            RefreshState();
        }

        private void OnStatusChanged(string _)
        {
            if (IsDisposed) return;
            if (InvokeRequired)
            {
                BeginInvoke(new Action(() => OnStatusChanged(_)));
                return;
            }
            RefreshState();
        }

        private void OnParticipantsChanged()
        {
            if (IsDisposed) return;
            if (InvokeRequired)
            {
                BeginInvoke(new Action(OnParticipantsChanged));
                return;
            }

            IReadOnlyList<string> members = service.IsConnected
                ? service.GetParticipantNames()
                : Array.Empty<string>();
            participantList.BeginUpdate();
            participantList.Items.Clear();
            foreach (string name in members)
            {
                participantList.Items.Add(name);
            }
            participantList.EndUpdate();
            memberCountLabel.Text = T($"{members.Count} connected", $"{members.Count}명 연결");
        }

        private void RefreshState()
        {
            bool connected = service.IsConnected;
            bool inputsEnabled = !connected && !busy;
            nameBox.Enabled = inputsEnabled;
            addressBox.Enabled = inputsEnabled && !hostMode;
            portBox.Enabled = inputsEnabled;
            passwordBox.Enabled = inputsEnabled;
            revealPasswordButton.Enabled = inputsEnabled;
            hostModeButton.Enabled = inputsEnabled;
            clientModeButton.Enabled = inputsEnabled;
            connectButton.Enabled = inputsEnabled;
            disconnectButton.Enabled = connected && !busy;
            copyEndpointButton.Enabled = connected && service.IsHost && !busy;

            hostModeButton.BackColor = hostMode ? AccentColor : InputColor;
            hostModeButton.ForeColor = hostMode ? Color.FromArgb(24, 24, 22) : Color.Gainsboro;
            clientModeButton.BackColor = hostMode ? InputColor : AccentColor;
            clientModeButton.ForeColor = hostMode ? Color.Gainsboro : Color.FromArgb(24, 24, 22);
            addressLabel.ForeColor = hostMode ? Color.FromArgb(112, 108, 99) : Color.Gainsboro;
            connectButton.Text = busy
                ? T("CONNECTING…", "연결 중…")
                : hostMode ? T("START HOST", "호스트 시작") : T("JOIN HOST", "호스트 참가");

            if (service.IsHost)
            {
                statusLabel.Text = T("HOSTING", "호스트 실행 중");
                statusLabel.ForeColor = ConnectedColor;
                endpointLabel.Text = T(
                    $"Listening on {GetLocalAddresses()}:{service.Port}. Forward TCP {service.Port} for internet clients.",
                    $"{GetLocalAddresses()}:{service.Port}에서 대기 중입니다. 외부 접속에는 TCP {service.Port} 포트 포워딩이 필요합니다.");
            }
            else if (service.IsConnected)
            {
                statusLabel.Text = T("CONNECTED", "연결됨");
                statusLabel.ForeColor = ConnectedColor;
                endpointLabel.Text = T(
                    $"Connected to {addressBox.Text.Trim()}:{service.Port}. Position packets are encrypted.",
                    $"{addressBox.Text.Trim()}:{service.Port}에 연결되었습니다. 위치 패킷은 암호화됩니다.");
            }
            else
            {
                statusLabel.Text = T("DISCONNECTED", "연결 안 됨");
                statusLabel.ForeColor = MutedColor;
                endpointLabel.Text = hostMode
                    ? T(
                        "Host mode listens on all network adapters. Router port forwarding and a firewall rule may be required.",
                        "호스트 모드는 모든 네트워크 어댑터에서 대기합니다. 공유기 포트 포워딩과 방화벽 허용이 필요할 수 있습니다.")
                    : T(
                        "Enter the host's public IP or DNS name and use the same port and password.",
                        "호스트의 공인 IP 또는 DNS 이름과 동일한 포트·비밀번호를 입력하세요.");
            }
            OnParticipantsChanged();
        }

        private void CopyHostEndpoint()
        {
            if (!service.IsHost) return;
            string address = GetLocalAddresses().Split(',')[0].Trim();
            string endpoint = $"{address}:{service.Port}";
            try
            {
                Clipboard.SetText(endpoint);
                copyEndpointButton.Text = T("COPIED", "복사됨");
                var timer = new System.Windows.Forms.Timer { Interval = 1400 };
                timer.Tick += (_, _) =>
                {
                    timer.Stop();
                    timer.Dispose();
                    if (!IsDisposed) copyEndpointButton.Text = T("COPY ADDRESS", "주소 복사");
                };
                timer.Start();
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, ex.Message, T("Unable to copy address", "주소 복사 실패"), MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private static string GetLocalAddresses()
        {
            try
            {
                string[] addresses = Dns.GetHostEntry(Dns.GetHostName()).AddressList
                    .Where(address => address.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(address))
                    .Select(address => address.ToString())
                    .Distinct()
                    .ToArray();
                return addresses.Length == 0 ? "local IP" : string.Join(", ", addresses);
            }
            catch
            {
                return "local IP";
            }
        }

        private string T(string english, string koreanText) => korean ? koreanText : english;

        private static void AddRow(TableLayoutPanel layout, int row, Control label, Control control)
        {
            layout.Controls.Add(label, 0, row);
            layout.Controls.Add(control, 1, row);
        }

        private static Label CreateFieldLabel(string text)
        {
            var label = new Label { Text = text };
            StyleFieldLabel(label);
            return label;
        }

        private static void StyleFieldLabel(Label label)
        {
            label.AutoSize = true;
            label.Anchor = AnchorStyles.Left;
            label.Margin = new Padding(0, 7, 8, 7);
            label.ForeColor = Color.Gainsboro;
        }

        private static void ConfigureTextBox(TextBox textBox)
        {
            textBox.Dock = DockStyle.Fill;
            textBox.BackColor = InputColor;
            textBox.ForeColor = Color.WhiteSmoke;
            textBox.BorderStyle = BorderStyle.FixedSingle;
            textBox.Margin = new Padding(0, 5, 0, 5);
        }

        private static void ConfigureModeButton(Button button, string text)
        {
            button.Text = text;
            button.Dock = DockStyle.Fill;
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderColor = BorderColor;
            button.FlatAppearance.MouseOverBackColor = AccentHoverColor;
            button.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
            button.UseVisualStyleBackColor = false;
        }

        private static void ConfigurePrimaryButton(Button button)
        {
            button.Dock = DockStyle.Fill;
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderSize = 0;
            button.FlatAppearance.MouseOverBackColor = AccentHoverColor;
            button.BackColor = AccentColor;
            button.ForeColor = Color.FromArgb(24, 24, 22);
            button.Font = new Font("Segoe UI", 9F, FontStyle.Bold);
            button.UseVisualStyleBackColor = false;
        }

        private static void ConfigureSecondaryButton(Button button, string text)
        {
            button.Text = text;
            button.Dock = DockStyle.Fill;
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderColor = BorderColor;
            button.FlatAppearance.MouseOverBackColor = Color.FromArgb(62, 58, 49);
            button.BackColor = InputColor;
            button.ForeColor = Color.Gainsboro;
            button.Font = new Font("Segoe UI", 8.5F, FontStyle.Bold);
            button.UseVisualStyleBackColor = false;
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                service.StatusChanged -= OnStatusChanged;
                service.ParticipantsChanged -= OnParticipantsChanged;
            }
            base.Dispose(disposing);
        }
    }
}
