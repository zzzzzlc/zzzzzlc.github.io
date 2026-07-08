import { useCssLab } from './hooks/useCssLab';
import { LabHeader } from './components/LabHeader';
import { EditorPane } from './components/EditorPane';
import { PreviewPane } from './components/PreviewPane';
import './index.css';

export default function CssTest() {
    const controller = useCssLab();

    return (
        <div className="css-lab">
            <LabHeader controller={controller} />

            {controller.error && (
                <pre className="css-lab-error-panel">{controller.error}</pre>
            )}

            <main className="css-lab-main">
                <EditorPane controller={controller} />
                <PreviewPane controller={controller} />
            </main>
        </div>
    );
}
