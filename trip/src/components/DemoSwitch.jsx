import s from './DemoSwitch.module.css'

/**
 * 演示状态切换器 —— 原型专用，真实产品中不存在。
 * 让答辩时可以手动展示同一页面的各个分支（v1/v2/生成失败、锁定前/执行期/已结束…）。
 * 上线前整组删除：搜索 DemoSwitch 即可定位全部调用点。
 */
export default function DemoSwitch({ label = '演示状态', options, value, onChange }) {
  return (
    <div className={s.bar}>
      <span>{label}：</span>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={`${s.btn} ${value === opt.value ? s.btnOn : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
