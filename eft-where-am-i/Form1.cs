using System;
using System.Drawing;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;
using eft_where_am_i;
using eft_where_am_i.Classes;
using Velopack;
using Velopack.Sources;
namespace eft_where_am_i_chasrp
{
    public partial class Form1 : Form
    {
        // UserControl을 캐싱해서 상태 유지
        private WhereAmI whereAmIControl;

        public Form1()
        {
            InitializeComponent();

            // 깜빡임 방지 옵션
            this.DoubleBuffered = true;
            this.SetStyle(ControlStyles.AllPaintingInWmPaint |
                          ControlStyles.UserPaint |
                          ControlStyles.OptimizedDoubleBuffer, true);

            InitializeScreens();
        }

        private void InitializeScreens()
        {
            // 화면 3개 생성 (딱 1번만)
            whereAmIControl = new WhereAmI();

            // Panel에 미리 추가
            panel1.Controls.Add(whereAmIControl);

            whereAmIControl.Dock = DockStyle.Fill;

            // 시작 화면 설정
            whereAmIControl.Visible = true;
        }

        const int MAX_SLIDING_WIDTH = 200;
        const int MIN_SLIDING_WIDTH = 75;
        const int STEP_SLIDING = 10;
        int _posSliding = 75;

        private void checkBoxHide_CheckedChanged(object sender, EventArgs e)
        {
            if (checkBoxHide.Checked == true)
            {
                btnWhereAmI.Text = "WHERE THE FUCK AM I";
                btnWhereAmI.Image = null;
                checkBoxHide.Text = "<";
            }
            else
            {
                btnWhereAmI.Text = "";
                btnWhereAmI.Image = Image.FromFile(@"assets\images\eft-where-am-i_icon_resize.png");
                checkBoxHide.Text = ">";
            }

            timerSliding.Start();
        }

        private void timerSliding_Tick(object sender, EventArgs e)
        {
            if (checkBoxHide.Checked == true)
            {
                _posSliding += STEP_SLIDING;
                if (_posSliding >= MAX_SLIDING_WIDTH)
                    timerSliding.Stop();
            }
            else
            {
                _posSliding -= STEP_SLIDING;
                if (_posSliding <= MIN_SLIDING_WIDTH)
                    timerSliding.Stop();
            }

            panelSideMenu.Width = _posSliding;
        }

        private async void Form1_Load(object sender, EventArgs e)
        {
            panelSideMenu.Width = _posSliding;
            checkBoxHide.Checked = false;

            // .csproj의 <Version>에서 자동 생성된 버전을 타이틀바에 표시
            var version = Assembly.GetExecutingAssembly()
                .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
                ?? Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "?";
            this.Text = $"WHERE THE FUCK AM I (v{version})";

            await CheckForUpdatesAsync();
        }

        private async Task CheckForUpdatesAsync()
        {
            try
            {
                string updateFeedUrl = SettingsHandler.Instance.GetSettings().update_feed_url;
                if (string.IsNullOrWhiteSpace(updateFeedUrl))
                {
                    return;
                }

                var mgr = new UpdateManager(new GithubSource(updateFeedUrl, null, false));
                
                // 개발 환경(디버거 모드)일 경우에만 건너뛰고, 무설치(Portable) 형태로 압축을 풀어 쓰는 유저도 업데이트를 받을 수 있게 합니다.
                if (System.Diagnostics.Debugger.IsAttached)
                {
                    return;
                }

                var newVersion = await mgr.CheckForUpdatesAsync();
                if (newVersion != null)
                {
                    var message = $"새로운 업데이트(v{newVersion.TargetFullRelease.Version})가 있습니다.\n다운로드 및 설치 후 앱을 재시작하시겠습니까?\n\n" +
                                  $"A new update (v{newVersion.TargetFullRelease.Version}) is available.\nWould you like to download, install, and restart the app?";
                                  
                    var result = MessageBox.Show(
                        message,
                        "업데이트 알림 / Update Notification", MessageBoxButtons.YesNo, MessageBoxIcon.Information);

                    if (result == DialogResult.Yes)
                    {
                        await mgr.DownloadUpdatesAsync(newVersion);
                        mgr.ApplyUpdatesAndRestart(newVersion);
                    }
                }
            }
            catch (Exception ex)
            {
                // 업데이트 오류 시 앱 실행을 방해하지 않도록 무시 또는 로깅
                Console.WriteLine($"업데이트 확인 중 오류: {ex.Message}");
            }
        }

        private void SwitchUserControl(UserControl control)
        {
            // 모든 화면 숨기기
            whereAmIControl.Visible = false;

            // 새 화면만 보이기
            control.Visible = true;
        }
    }

    // 초기 경로 설정은 WhereAmI.cs에서 처리
}
