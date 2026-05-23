import { UserAddOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Flex, Input, List, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { MobileShell } from '../layouts/MobileShell'
import type { AdminUser } from '../storage/adminUsersRepo'
import { getUserIdByEmail, grantAdmin, listAdmins } from '../storage/adminUsersRepo'

export function UserManagementPage() {
  const { session } = useAuth()
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    listAdmins()
      .then(setAdmins)
      .catch((e: Error) => console.error('listAdmins error:', e))
  }, [])

  async function handleGrant() {
    if (!email.trim()) return
    setLoading(true)
    setSuccessMsg(null)
    setErrorMsg(null)
    try {
      const userId = await getUserIdByEmail(email.trim())
      if (!userId) {
        setErrorMsg(`이메일(${email.trim()})에 해당하는 사용자를 찾을 수 없습니다.`)
        return
      }
      const grantedBy = session?.user?.id ?? ''
      await grantAdmin(userId, grantedBy)
      setSuccessMsg(`${email.trim()} 님에게 관리자 권한을 부여했습니다.`)
      setEmail('')
      const updated = await listAdmins()
      setAdmins(updated)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setErrorMsg(`권한 부여 실패: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <MobileShell title="유저 관리">
      <Flex vertical gap={16}>
        <Card title="관리자 권한 부여">
          <Flex gap={8}>
            <Input
              placeholder="이메일 주소 입력"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onPressEnter={handleGrant}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              loading={loading}
              onClick={handleGrant}
            >
              승격
            </Button>
          </Flex>
          {successMsg && (
            <Alert
              type="success"
              message={successMsg}
              showIcon
              style={{ marginTop: 12 }}
              closable
              onClose={() => setSuccessMsg(null)}
            />
          )}
          {errorMsg && (
            <Alert
              type="error"
              message={errorMsg}
              showIcon
              style={{ marginTop: 12 }}
              closable
              onClose={() => setErrorMsg(null)}
            />
          )}
        </Card>

        <Card title="현재 관리자 목록">
          <List
            dataSource={admins}
            locale={{ emptyText: '관리자가 없습니다.' }}
            renderItem={(item) => (
              <List.Item>
                <Typography.Text code>{item.email ?? item.user_id}</Typography.Text>
                <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  {new Date(item.granted_at).toLocaleDateString('ko-KR')}
                </Typography.Text>
              </List.Item>
            )}
          />
        </Card>
      </Flex>
    </MobileShell>
  )
}
