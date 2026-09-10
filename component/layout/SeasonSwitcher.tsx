import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { useThemeMode } from '../../app/theme/ThemeProvider';
import { SEASONS, type SeasonName } from '../../app/theme/season';

/**
 * 季节主题切换器：Header 上的下拉菜单（默认/春/夏/秋/冬）。
 * 切换走 VT 圆形扩散动画（从菜单项点击坐标展开），与亮暗切换同款体验。
 */
export default function SeasonSwitcher() {
    const { mode, season, setSeasonFromEvent } = useThemeMode();

    const handleMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
        // 键盘触发菜单时无鼠标坐标，取 Header 右上角作扩散圆心
        const anchor = 'clientX' in domEvent
            ? { clientX: domEvent.clientX, clientY: domEvent.clientY }
            : { clientX: window.innerWidth - 60, clientY: 60 };
        setSeasonFromEvent(key as SeasonName, anchor);
    };

    const items: MenuProps['items'] = SEASONS.map(({ key, label, icon }) => ({
        key,
        label: (
            <span>
                <span style={{ marginRight: 8 }}>{icon}</span>
                {label}
            </span>
        ),
    }));

    const current = SEASONS.find((s) => s.key === season) ?? SEASONS[0];

    return (
        <Dropdown
            menu={{ items, selectedKeys: [season], onClick: handleMenuClick }}
            placement="bottomRight"
            trigger={['click']}
        >
            <button
                type="button"
                className="blog-theme-toggle"
                title={`季节主题：${current.label}（当前${mode === 'dark' ? '暗' : '亮'}色）`}
                aria-label="切换季节主题"
            >
                {current.icon}
            </button>
        </Dropdown>
    );
}
