using System;
using System.IO;
using System.Text;
using System.Security.Cryptography;

class AssetUnpack {
    static int Main(string[] args) {
        try {
            string target = Path.GetFullPath(Path.Combine(args[1], "源码", "dsh-pet", "assets", "webm"));
            Directory.CreateDirectory(target);
            using (var input = new BinaryReader(File.OpenRead(args[0]), Encoding.UTF8)) {
                if (Encoding.ASCII.GetString(input.ReadBytes(8)) != "DANYA001") throw new Exception("素材包格式无效");
                int count = input.ReadInt32();
                if (count != 83) throw new Exception("素材数量错误");
                byte[] buffer = new byte[1048576];
                for (int i = 0; i < count; i++) {
                    string name = Encoding.UTF8.GetString(input.ReadBytes(input.ReadUInt16()));
                    if (name != Path.GetFileName(name) || !name.EndsWith(".webm")) throw new Exception("素材路径错误");
                    long remaining = input.ReadInt64();
                    string expected = BitConverter.ToString(input.ReadBytes(32));
                    using (var hash = SHA256.Create()) using (var output = File.Create(Path.Combine(target, name))) {
                        while (remaining > 0) {
                            int size = input.Read(buffer, 0, (int)Math.Min(remaining, buffer.Length));
                            if (size == 0) throw new Exception("素材包不完整");
                            output.Write(buffer, 0, size);
                            hash.TransformBlock(buffer, 0, size, null, 0);
                            remaining -= size;
                        }
                        hash.TransformFinalBlock(buffer, 0, 0);
                        if (BitConverter.ToString(hash.Hash) != expected) throw new Exception("素材校验失败");
                    }
                }
            }
            return 0;
        } catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    }
}
