import { AppstoreOutlined, BookOutlined, CalendarOutlined, HomeOutlined, ShoppingOutlined, TeamOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { Button, Flex, theme } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'

type NavItem = {
  key: string
  label: string
  path: string
  icon: ReactNode
  adminOnly?: boolean
}

const NAV: NavItem[] = [
  { key: 'home', label: '홈', path: '/', icon: <HomeOutlined /> },
  { key: 'create', label: '생성', path: '/create', icon: <CalendarOutlined /> },
  { key: 'manage', label: '관리', path: '/manage', icon: <UnorderedListOutlined /> },
  { key: 'preps', label: '프렙', path: '/preps', icon: <AppstoreOutlined /> },
  { key: 'menu', label: '메뉴', path: '/menu', icon: <BookOutlined /> },
  { key: 'ingredients', label: '재료', path: '/ingredients', icon: <ShoppingOutlined /> },
  { key: 'users', label: '유저', path: '/users', icon: <TeamOutlined />, adminOnly: true },
]

function isActive(currentPath: string, itemPath: string) {
  if (itemPath === '/') return currentPath === '/'
  return currentPath.startsWith(itemPath)
}

export function BottomNav() {
  const { token } = theme.useToken()
  const nav = useNavigate()
  const loc = useLocation()
  const { isAdmin } = useAuth()

  const visibleNav = NAV.filter((it) => !it.adminOnly || isAdmin)

  return (
    <div
      style={{
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        paddingTop: 6,
      }}
    >
      <Flex justify="space-around" align="center">
        {visibleNav.map((it) => {
          const active = isActive(loc.pathname, it.path)
          return (
            <Button
              key={it.key}
              type="text"
              onClick={() => nav(it.path)}
              style={{
                height: 'auto',
                padding: '6px 10px',
                color: active ? token.colorPrimary : token.colorTextSecondary,
              }}
            >
              <Flex vertical align="center" gap={2}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{it.icon}</span>
                <span style={{ fontSize: 12, lineHeight: 1.1 }}>{it.label}</span>
              </Flex>
            </Button>
          )
        })}
      </Flex>
    </div>
  )
}


