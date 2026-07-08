import type { CssTestController } from '../types';

export interface PreviewPaneProps {
    controller: CssTestController;
}

/** iframe 预览：srcDoc 注入编译后的 CSS + HTML */
export function PreviewPane({ controller }: PreviewPaneProps) {
    const { srcDoc } = controller;

    return (
        <section className="css-lab-preview">
            <iframe title="preview" srcDoc={srcDoc} />
        </section>
    );
}
