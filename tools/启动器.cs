using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

class Launcher {
    [STAThread]
    static void Main() {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string runtime = Path.Combine(root, "运行时", "达妮娅桌宠.exe");
        string server = Path.Combine(root, "源码", "dsh-pet", "standalone", "server.mjs");
        if (!File.Exists(runtime) || !File.Exists(server)) {
            MessageBox.Show("请保留成品文件夹的完整结构，再启动桌宠。", "达妮娅桌宠");
            return;
        }
        try {
            var start = new ProcessStartInfo(runtime, "\"" + server + "\"");
            start.WorkingDirectory = root;
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            start.WindowStyle = ProcessWindowStyle.Hidden;
            start.EnvironmentVariables["ELECTRON_RUN_AS_NODE"] = "1";
            start.EnvironmentVariables.Remove("DSH_PET_SMOKE");
            start.EnvironmentVariables.Remove("DSH_PET_SMOKE_OUT");
            Process.Start(start);
        } catch (Exception error) {
            MessageBox.Show("启动失败：" + error.Message, "达妮娅桌宠");
        }
    }
}
