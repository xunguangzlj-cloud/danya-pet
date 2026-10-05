/** 桌面窗口和DSH网页共用的大小滑杆，保存请求串行，最后一次拖动不会丢失。 */
export declare function mountSizeEditor(opts: {
    size: number;
    onSize: (size: number) => Promise<void>;
    onClose: () => void;
}): {
    close: () => Promise<void>;
};
