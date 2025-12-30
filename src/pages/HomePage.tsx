import { Card } from 'antd'
import { Link } from 'react-router-dom'
import { MobileShell } from '../layouts/MobileShell'

export function HomePage() {
  return (
    <MobileShell title={<span className="leedeli-title">LEE DELI</span>}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginTop: 24,
          justifyItems: 'center',
          alignItems: 'center',
          width: '100%',
          maxWidth: 520,
          marginLeft: 'auto',
          marginRight: 'auto',
          paddingInline: 8,
          boxSizing: 'border-box',
        }}
      >
        <Link to="/create" style={{ width: '100%', maxWidth: 180, textDecoration: 'none' }}>
          <Card hoverable className="leedeli-card">
            스케줄 생성
          </Card>
        </Link>
        <Link to="/manage" style={{ width: '100%', maxWidth: 180, textDecoration: 'none' }}>
          <Card hoverable className="leedeli-card">
            스케줄 관리
          </Card>
        </Link>
        <Link to="/preps" style={{ width: '100%', maxWidth: 180, textDecoration: 'none' }}>
          <Card hoverable className="leedeli-card">
            프렙/소스
          </Card>
        </Link>
        <Link to="/ingredients" style={{ width: '100%', maxWidth: 180, textDecoration: 'none' }}>
          <Card hoverable className="leedeli-card">
            재료
          </Card>
        </Link>
      </div>
    </MobileShell>
  )
}
