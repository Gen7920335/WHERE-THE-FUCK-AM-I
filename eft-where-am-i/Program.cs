using System;
using System.Windows.Forms;
using eft_where_am_i.Classes;

namespace eft_where_am_i_chasrp
{
    internal static class Program
    {
        /// <summary>
        /// 해당 애플리케이션의 주 진입점입니다.
        /// </summary>
        [STAThread]
        static void Main(string[] args)
        {
            if (PortableUpdateService.TryRunApplyMode(args))
                return;

            PortableUpdateService.CleanupStaleUpdateDirectories();

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new Form1());
        }
    }
}
