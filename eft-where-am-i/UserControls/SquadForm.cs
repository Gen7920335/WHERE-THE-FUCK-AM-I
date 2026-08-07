using System.Net;
using System.Net.Sockets;
using eft_where_am_i.Classes;

namespace eft_where_am_i
{
    internal sealed class SquadForm : Form
    {
        private readonly SquadNetworkService service;
        private readonly TextBox nameBox = new();
        private readonly TextBox addressBox = new();
        private readonly NumericUpDown portBox = new();
        private readonly TextBox passwordBox = new();
        private readonly Button hostButton = new();
        private readonly Button joinButton = new();
        private readonly Button disconnectButton = new();
        private readonly Label statusLabel = new();
        private readonly Label endpointLabel = new();
        private readonly ListBox participantList = new();
        private readonly bool korean;

        public SquadForm(SquadNetworkService service)
        {
            this.service = service;
            korean = string.Equals(SettingsHandler.Instance.GetSettings().language, "ko", StringComparison.OrdinalIgnoreCase);
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
            Text = T("Squad Multiplayer", "스쿼드 멀티플레이어");
            ClientSize = new Size(500, 410);
            MinimumSize = new Size(500, 410);
            StartPosition = FormStartPosition.CenterParent;
            BackColor = Color.FromArgb(38, 38, 38);
            ForeColor = Color.WhiteSmoke;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;

            var layout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(16),
                ColumnCount = 2,
                RowCount = 9,
                BackColor = BackColor
            };
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 115));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            Controls.Add(layout);

            ConfigureTextBox(nameBox);
            ConfigureTextBox(addressBox);
            ConfigureTextBox(passwordBox);
            passwordBox.UseSystemPasswordChar = true;
            portBox.Minimum = 1024;
            portBox.Maximum = 65535;
            portBox.Value = 16243;
            portBox.Dock = DockStyle.Fill;
            portBox.BackColor = Color.FromArgb(58, 58, 58);
            portBox.ForeColor = Color.WhiteSmoke;
            portBox.BorderStyle = BorderStyle.FixedSingle;

            AddRow(layout, 0, T("Player name", "플레이어 이름"), nameBox);
            AddRow(layout, 1, T("Host IP", "호스트 IP"), addressBox);
            AddRow(layout, 2, T("Port", "포트"), portBox);
            AddRow(layout, 3, T("Password", "비밀번호"), passwordBox);

            var buttons = new FlowLayoutPanel
            {
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.LeftToRight,
                WrapContents = false,
                AutoSize = true
            };
            ConfigureButton(hostButton, T("Host", "호스트 열기"));
            ConfigureButton(joinButton, T("Join", "참가"));
            ConfigureButton(disconnectButton, T("Disconnect", "연결 끊기"));
            hostButton.Click += async (_, _) => await StartHostAsync();
            joinButton.Click += async (_, _) => await JoinAsync();
            disconnectButton.Click += (_, _) => service.Stop();
            buttons.Controls.AddRange([hostButton, joinButton, disconnectButton]);
            layout.Controls.Add(buttons, 1, 4);

            statusLabel.Text = T("Disconnected", "연결 안 됨");
            statusLabel.AutoSize = true;
            statusLabel.ForeColor = Color.FromArgb(170, 204, 255);
            layout.Controls.Add(CreateLabel(T("Status", "상태")), 0, 5);
            layout.Controls.Add(statusLabel, 1, 5);

            endpointLabel.Text = T(
                "Host mode requires TCP port forwarding and a Windows Firewall rule.",
                "인터넷 호스트는 TCP 포트 포워딩과 Windows 방화벽 허용이 필요합니다.");
            endpointLabel.AutoSize = true;
            endpointLabel.MaximumSize = new Size(335, 0);
            endpointLabel.ForeColor = Color.Silver;
            layout.Controls.Add(CreateLabel(T("Connection", "접속 정보")), 0, 6);
            layout.Controls.Add(endpointLabel, 1, 6);

            participantList.Dock = DockStyle.Fill;
            participantList.BackColor = Color.FromArgb(48, 48, 48);
            participantList.ForeColor = Color.WhiteSmoke;
            participantList.BorderStyle = BorderStyle.FixedSingle;
            layout.Controls.Add(CreateLabel(T("Members", "참가자")), 0, 7);
            layout.Controls.Add(participantList, 1, 7);
            layout.SetRowSpan(participantList, 2);

            for (int row = 0; row < 7; row++)
            {
                layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            }
            layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 8));
        }

        private async Task StartHostAsync()
        {
            try
            {
                SaveValues();
                await service.StartHostAsync((int)portBox.Value, passwordBox.Text, nameBox.Text);
                RefreshState();
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, ex.Message, T("Unable to host squad", "스쿼드 호스트 실패"), MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private async Task JoinAsync()
        {
            try
            {
                SaveValues();
                await service.JoinAsync(addressBox.Text, (int)portBox.Value, passwordBox.Text, nameBox.Text);
                RefreshState();
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, ex.Message, T("Unable to join squad", "스쿼드 참가 실패"), MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void LoadSavedValues()
        {
            AppSettings settings = SettingsHandler.Instance.GetSettings();
            nameBox.Text = string.IsNullOrWhiteSpace(settings.squad_name) ? Environment.UserName : settings.squad_name;
            addressBox.Text = string.IsNullOrWhiteSpace(settings.squad_host) ? "127.0.0.1" : settings.squad_host;
            portBox.Value = Math.Clamp(settings.squad_port, 1024, 65535);
        }

        private void SaveValues()
        {
            AppSettings settings = SettingsHandler.Instance.GetSettings();
            settings.squad_name = nameBox.Text.Trim();
            settings.squad_host = addressBox.Text.Trim();
            settings.squad_port = (int)portBox.Value;
            SettingsHandler.Instance.UpdateSettings(settings);
        }

        private void OnStatusChanged(string status)
        {
            if (IsDisposed) return;
            if (InvokeRequired)
            {
                BeginInvoke(new Action(() => OnStatusChanged(status)));
                return;
            }
            statusLabel.Text = status;
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
            participantList.BeginUpdate();
            participantList.Items.Clear();
            foreach (string name in service.GetParticipantNames())
            {
                participantList.Items.Add(name);
            }
            participantList.EndUpdate();
        }

        private void RefreshState()
        {
            bool connected = service.IsConnected;
            nameBox.Enabled = !connected;
            addressBox.Enabled = !connected;
            portBox.Enabled = !connected;
            passwordBox.Enabled = !connected;
            hostButton.Enabled = !connected;
            joinButton.Enabled = !connected;
            disconnectButton.Enabled = connected;
            if (service.IsHost)
            {
                endpointLabel.Text = korean
                    ? $"{GetLocalAddresses()}:{service.Port}에서 대기 중. 외부 참가자는 공유기에서 TCP {service.Port} 포트를 포워딩해야 합니다."
                    : $"Listening on {GetLocalAddresses()}:{service.Port}. Forward TCP {service.Port} on the router for internet clients.";
            }
            else if (service.IsConnected)
            {
                endpointLabel.Text = korean
                    ? $"{addressBox.Text}:{service.Port}에 연결됨. 위치 패킷은 암호화됩니다."
                    : $"Connected to {addressBox.Text}:{service.Port}. Position packets are encrypted.";
            }
            else
            {
                endpointLabel.Text = T(
                    "Host mode requires TCP port forwarding and a Windows Firewall rule.",
                    "인터넷 호스트는 TCP 포트 포워딩과 Windows 방화벽 허용이 필요합니다.");
            }
            OnParticipantsChanged();
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

        private static void AddRow(TableLayoutPanel layout, int row, string label, Control control)
        {
            layout.Controls.Add(CreateLabel(label), 0, row);
            layout.Controls.Add(control, 1, row);
        }

        private static Label CreateLabel(string text) => new()
        {
            Text = text,
            AutoSize = true,
            Anchor = AnchorStyles.Left,
            Margin = new Padding(0, 7, 8, 7),
            ForeColor = Color.Gainsboro
        };

        private static void ConfigureTextBox(TextBox textBox)
        {
            textBox.Dock = DockStyle.Fill;
            textBox.BackColor = Color.FromArgb(58, 58, 58);
            textBox.ForeColor = Color.WhiteSmoke;
            textBox.BorderStyle = BorderStyle.FixedSingle;
        }

        private static void ConfigureButton(Button button, string text)
        {
            button.Text = text;
            button.AutoSize = true;
            button.FlatStyle = FlatStyle.Flat;
            button.FlatAppearance.BorderColor = Color.FromArgb(141, 122, 80);
            button.BackColor = Color.FromArgb(58, 58, 58);
            button.ForeColor = Color.WhiteSmoke;
            button.Margin = new Padding(0, 3, 8, 3);
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
