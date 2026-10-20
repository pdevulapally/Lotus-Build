import type { ShowcaseKind } from './landing-content'
import styles from './landing-hero.module.css'

const bars = [38, 62, 48, 80, 66, 92, 58]
const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const stock = [{ name: 'Flour 25kg', level: 82 }, { name: 'Butter', level: 34 }, { name: 'Yeast', level: 12 }]
const invoiceLines = [['Brand refresh', '£1,800'], ['Website build', '£3,200'], ['Hosting (12 mo)', '£240']]

function Stat() {
  return <div className={styles.mock}>
    <strong className={styles.bigNumber}>128</strong>
    <span className={styles.delta}>+18% vs last week</span>
    <div className={styles.bars}>{bars.map((height, index) => <i key={index} style={{ height: `${height}%` }} data-peak={height === 92 || undefined} />)}</div>
  </div>
}

function CalendarMock() {
  return <div className={styles.mock}>
    <div className={styles.calendarHead}>{days.map((day, index) => <span key={index}>{day}</span>)}</div>
    <div className={styles.calendarGrid}>{Array.from({ length: 21 }, (_, index) => <i key={index} data-selected={index === 10 || undefined} data-muted={index < 2 || undefined} />)}</div>
    <span className={styles.slot}>Thu 11 · 2:30 pm</span>
  </div>
}

function Board() {
  return <div className={styles.board}>
    {[['Waiting', 2], ['Approved', 3], ['Paid', 1]].map(([label, count]) => <div key={label}>
      <span>{label} <b>{count}</b></span>
      {Array.from({ length: Number(count) }, (_, index) => <i key={index} />)}
    </div>)}
  </div>
}

function Invoice() {
  return <div className={styles.mock}>
    <ul className={styles.invoice}>{invoiceLines.map(([item, amount]) => <li key={item}><span>{item}</span><span>{amount}</span></li>)}</ul>
    <div className={styles.invoiceTotal}><span>Total</span><strong>£5,240</strong></div>
  </div>
}

function Stock() {
  return <div className={styles.mock}>
    <ul className={styles.stock}>{stock.map((item) => <li key={item.name}><span>{item.name}</span><i><b style={{ width: `${item.level}%` }} data-low={item.level < 20 || undefined} /></i></li>)}</ul>
    <span className={styles.delta}>1 item running low</span>
  </div>
}

function Storefront() {
  return <div className={styles.storefront}>
    <div className={styles.storeNav}><b /><span /><span /><span /></div>
    <strong>Fresh bread,<br />baked before dawn.</strong>
    <div className={styles.storeActions}><em>Order for pickup</em><span>Our story</span></div>
  </div>
}

export const showcaseVisuals: Record<ShowcaseKind, () => React.JSX.Element> = {
  stat: Stat,
  calendar: CalendarMock,
  board: Board,
  invoice: Invoice,
  bookings: Stock,
  storefront: Storefront,
}
