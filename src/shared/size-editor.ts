/** 桌面窗口和DSH网页共用的大小滑杆，保存请求串行，最后一次拖动不会丢失。 */
export function mountSizeEditor(opts: { size: number; onSize: (size: number) => Promise<void>; onClose: () => void }) {
  const root = document.createElement('dialog');
  root.className = 'pet-size-editor';
  root.style.cssText = 'width:min(340px,80vw);padding:24px;border:1px solid #405272;border-radius:14px;background:#20293b;color:#e9eef8;font:16px Microsoft YaHei,sans-serif;z-index:2147483647';
  root.innerHTML = '<h2 style="margin:0 0 18px;font-size:23px">调整大小</h2><label>大小 <output></output> px<input aria-label="调整大小" type="range" min="160" max="1280" step="10" style="width:100%;margin:18px 0;accent-color:#9fbcff"></label><p style="font-size:13px;color:#abbad0">拖动滑杆，实时等比调整；大小会自动保存。</p><p role="status" style="font-size:13px;min-height:18px"></p><button style="padding:6px 16px;cursor:pointer">关闭</button>';
  const slider = root.querySelector('input')!;
  const output = root.querySelector('output')!;
  const status = root.querySelector('[role="status"]')!;
  slider.value = String(opts.size);
  output.textContent = slider.value;
  let pending: number | undefined;
  let saving: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (saving) return saving;
    saving = (async () => {
      while (pending !== undefined) {
        const size = pending;
        pending = undefined;
        try { await opts.onSize(size); status.textContent = '已保存'; }
        catch (error) { status.textContent = error instanceof Error ? error.message : '保存失败'; }
      }
    })().finally(() => { saving = undefined; });
    return saving;
  };
  slider.oninput = () => {
    output.textContent = slider.value;
    pending = Number(slider.value);
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), 100);
  };
  const close = async () => {
    clearTimeout(timer);
    await flush();
    root.remove();
    opts.onClose();
  };
  root.querySelector('button')!.onclick = close;
  root.oncancel = event => { event.preventDefault(); close(); };
  document.body.appendChild(root);
  root.showModal();
  return { close };
}
