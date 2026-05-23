import { UserAddOutlined, UserDeleteOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Flex, Input, List, Table, Tag, Typography } from 'antd'
import type { ColumnType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { MobileShell } from '../layouts/MobileShell'
import type { ActiveAdmin, AllUser } from '../storage/adminUsersRepo'
import { getActiveAdmins, getAllUsers, getUserIdByEmail, grantAdmin, revokeAdmin } from '../storage/adminUsersRepo'

export function UserManagementPage() {
  const { session } = useAuth()
  const [users, setUsers] = useState<AllUser[]>([])
  const [admins, setAdmins] = useState<ActiveAdmin[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [tableLoading, setTableLoading] = useState(false)
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function refreshUsers(): Promise<void> {
    setTableLoading(true)
    try {
      const data = await getAllUsers()
      setUsers(data)
    } catch (e: unknown) {
      console.error('getAllUsers error:', e)
    } finally {
      setTableLoading(false)
    }
  }

  async function refreshAdmins(): Promise<void> {
    setAdminsLoading(true)
    try {
      const data = await getActiveAdmins()
      setAdmins(data)
    } catch (e: unknown) {
      console.error('getActiveAdmins error:', e)
    } finally {
      setAdminsLoading(false)
    }
  }

  useEffect(() => {
    void refreshUsers()
    void refreshAdmins()
  }, [])

  async function handleGrant(): Promise<void> {
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
      await Promise.all([refreshUsers(), refreshAdmins()])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setErrorMsg(`권한 부여 실패: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleGrantById(userId: string, userEmail: string | null): Promise<void> {
    setActionLoadingId(userId)
    setSuccessMsg(null)
    setErrorMsg(null)
    try {
      const grantedBy = session?.user?.id ?? ''
      await grantAdmin(userId, grantedBy)
      setSuccessMsg(`${userEmail ?? userId} 님에게 관리자 권한을 부여했습니다.`)
      await Promise.all([refreshUsers(), refreshAdmins()])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setErrorMsg(`권한 부여 실패: ${msg}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleRevoke(userId: string, userEmail: string | null): Promise<void> {
    setActionLoadingId(userId)
    setSuccessMsg(null)
    setErrorMsg(null)
    try {
      await revokeAdmin(userId)
      setSuccessMsg(`${userEmail ?? userId} 님의 관리자 권한을 취소했습니다.`)
      await Promise.all([refreshUsers(), refreshAdmins()])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setErrorMsg(`권한 취소 실패: ${msg}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  const columns: ColumnType<AllUser>[] = [
    {
      title: '이메일',
      dataIndex: 'email',
      key: 'email',
      render: (value: string | null) => (
        <Typography.Text>{value ?? '(이메일 없음)'}</Typography.Text>
      ),
    },
    {
      title: '가입일',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string) => new Date(value).toLocaleDateString('ko-KR'),
    },
    {
      title: '권한',
      dataIndex: 'is_admin',
      key: 'is_admin',
      render: (value: boolean) =>
        value ? <Tag color="gold">관리자</Tag> : <Tag>일반</Tag>,
    },
    {
      title: '작업',
      key: 'action',
      render: (_: unknown, record: AllUser) =>
        record.is_admin ? (
          <Button
            size="small"
            danger
            icon={<UserDeleteOutlined />}
            loading={actionLoadingId === record.id}
            onClick={() => void handleRevoke(record.id, record.email)}
          >
            취소
          </Button>
        ) : (
          <Button
            size="small"
            type="primary"
            icon={<UserAddOutlined />}
            loading={actionLoadingId === record.id}
            onClick={() => void handleGrantById(record.id, record.email)}
          >
            승격
          </Button>
        ),
    },
  ]

  return (
    <MobileShell title="유저 관리">
      <Flex vertical gap={16}>
        <Card title="관리자 권한 부여 (이메일)">
          <Flex gap={8}>
            <Input
              placeholder="이메일 주소 입력"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onPressEnter={() => void handleGrant()}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              loading={loading}
              onClick={() => void handleGrant()}
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
          <List<ActiveAdmin>
            loading={adminsLoading}
            dataSource={admins}
            locale={{ emptyText: '관리자가 없습니다.' }}
            renderItem={(admin) => (
              <List.Item key={admin.id}>
                <Typography.Text code>{admin.user_id}</Typography.Text>
                <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                  {new Date(admin.granted_at).toLocaleDateString('ko-KR')} 부여
                </Typography.Text>
              </List.Item>
            )}
          />
        </Card>

        <Card title="전체 유저 목록">
          <Table<AllUser>
            dataSource={users}
            columns={columns}
            rowKey="id"
            loading={tableLoading}
            size="small"
            locale={{ emptyText: '유저가 없습니다.' }}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
          />
        </Card>
      </Flex>
    </MobileShell>
  )
}
