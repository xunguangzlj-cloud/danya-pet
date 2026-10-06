using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.ComponentModel;
using System.Windows.Forms;

class MergeAssets {
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr ShellExecuteW(IntPtr hwnd, string verb, string file, string parameters, string directory, int showCmd);

    // 交给 shell 打开安装程序（语义同 Process.Start + UseShellExecute = true）
    private static void ShellExecuteOpen(string file, string workingDir) {
        IntPtr result = ShellExecuteW(IntPtr.Zero, "open", file, null, workingDir, 1);
        if ((long)result <= 32) MessageBox.Show("启动安装程序失败，请手动双击 DanyaPet-Setup.exe。");
    }

    static string BaseDir = AppDomain.CurrentDomain.BaseDirectory;
    static string Target = Path.Combine(BaseDir, "角色素材.dat");
    static string Expected = "a81028237338230678eabb07298b2a79772ea27da101d65b0694d55e19e0660a";
    static void Merge(Action<int> progress) {
        string[] parts = {"danya-assets.dat.001", "danya-assets.dat.002", "danya-assets.dat.003"};
        long total = 0;
        foreach (string part in parts) {
            string path = Path.Combine(BaseDir, part);
            if (!File.Exists(path)) throw new Exception("缺少 " + part + "，请下载全部三个分卷并放在此程序旁边。");
            total += new FileInfo(path).Length;
        }
        string temp = Target + ".partial";
        long copied = 0;
        using (var hash = SHA256.Create()) using (var output = File.Create(temp)) {
            byte[] buffer = new byte[1048576];
            foreach (string part in parts) using (var input = File.OpenRead(Path.Combine(BaseDir, part))) {
                int size;
                while ((size = input.Read(buffer, 0, buffer.Length)) > 0) {
                    output.Write(buffer, 0, size);
                    hash.TransformBlock(buffer, 0, size, null, 0);
                    copied += size; progress((int)(copied * 100 / total));
                }
            }
            hash.TransformFinalBlock(buffer, 0, 0);
            string actual = BitConverter.ToString(hash.Hash).Replace("-", "").ToLowerInvariant();
            if (actual != Expected) throw new Exception("素材校验失败，请重新下载分卷。未启动安装。");
        }
        if (File.Exists(Target)) File.Delete(Target);
        File.Move(temp, Target);
    }
    [STAThread]
    static int Main(string[] args) {
        if (args.Length == 1 && args[0] == "--merge-only") {
            try { Merge(delegate(int p) {}); return 0; }
            catch { return 1; }
        }
        Application.EnableVisualStyles();
        var form = new Form { Text = "达妮娅桌宠 · 合并高清素材", Width = 520, Height = 240, StartPosition = FormStartPosition.CenterScreen, FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false };
        var label = new Label { Left = 24, Top = 22, Width = 460, Height = 60, Text = "请将三个素材分卷与安装程序放在此工具旁边。\n点击合并，自动校验完整素材后即可安装。" };
        var bar = new ProgressBar { Left = 24, Top = 92, Width = 456, Height = 24 };
        var button = new Button { Left = 24, Top = 138, Width = 160, Height = 34, Text = "合并素材" };
        bool ready = false, busy = false;
        var worker = new BackgroundWorker { WorkerReportsProgress = true };
        int last = -1;
        worker.DoWork += delegate { Merge(delegate(int p) { if (p != last) { last = p; worker.ReportProgress(p); } }); };
        worker.ProgressChanged += delegate(object sender, ProgressChangedEventArgs e) { bar.Value = e.ProgressPercentage; };
        worker.RunWorkerCompleted += delegate(object sender, RunWorkerCompletedEventArgs e) {
            busy = false; button.Enabled = true;
            if (e.Error != null) { label.Text = e.Error.Message; bar.Value = 0; return; }
            ready = true; label.Text = "素材合并与 SHA256 校验通过。\n点击“启动安装”，按中文向导完成安装。"; button.Text = "启动安装";
        };
        button.Click += delegate {
            if (!ready) { busy = true; button.Enabled = false; label.Text = "正在合并并校验，请稍候……\n大约需要额外 4 GB 磁盘空间。"; worker.RunWorkerAsync(); return; }
            string installer = Path.Combine(BaseDir, "DanyaPet-Setup.exe");
            if (!File.Exists(installer)) { MessageBox.Show("缺少 DanyaPet-Setup.exe，请将安装程序放到此目录。"); return; }
            // 路径由本目录常量拼出；Windows 路径不允许出现引号，显式校验后再启动
            if (installer.Contains("\"")) { MessageBox.Show("路径包含非法字符，已拒绝启动安装程序。"); return; }
            ShellExecuteOpen(installer, BaseDir); form.Close();
        };
        form.FormClosing += delegate(object sender, FormClosingEventArgs e) { if (busy) { e.Cancel = true; label.Text = "正在合并，请完成后再关闭窗口。"; } };
        form.Controls.AddRange(new Control[] { label, bar, button }); Application.Run(form); return 0;
    }
}
