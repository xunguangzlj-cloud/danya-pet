using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;

class Launcher {
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr ShellExecuteW(IntPtr hwnd, string verb, string file, string parameters, string directory, int showCmd);

    // 交给 shell 打开（语义同 Process.Start + UseShellExecute）：子进程继承当前环境变量
    private static void ShellExecuteOpen(string file, string parameters, string workingDir) {
        IntPtr result = ShellExecuteW(IntPtr.Zero, "open", file, parameters, workingDir, 1);
        if ((long)result <= 32) MessageBox.Show("启动失败，请确认文件结构完整后重试。", "达妮娅桌宠");
    }

    [STAThread]
    static void Main() {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string runtime = Path.Combine(root, "运行时", "达妮娅桌宠.exe");
        string server = Path.Combine(root, "源码", "dsh-pet", "standalone", "server.mjs");
        if (!File.Exists(runtime) || !File.Exists(server)) {
            MessageBox.Show("请保留成品文件夹的完整结构，再启动桌宠。", "达妮娅桌宠");
            return;
        }
        // 两个路径都由本目录常量拼出；Windows 路径不允许出现引号，显式校验后再传参
        if (runtime.Contains("\"") || server.Contains("\"")) {
            MessageBox.Show("路径包含非法字符，已拒绝启动。", "达妮娅桌宠");
            return;
        }
        // 子进程继承当前环境：ELECTRON_RUN_AS_NODE 让运行时以 Node 模式跑 server.mjs；冒烟专用变量不外传
        Environment.SetEnvironmentVariable("ELECTRON_RUN_AS_NODE", "1");
        Environment.SetEnvironmentVariable("DSH_PET_SMOKE", null);
        Environment.SetEnvironmentVariable("DSH_PET_SMOKE_OUT", null);
        ShellExecuteOpen(runtime, string.Concat('"', server, '"'), root);
    }
}
