import { ReloadOutlined, UserAddOutlined, UserDeleteOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Flex, Input, List, Table, Tag, Typography } from 'antd'
import type { ColumnType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { MobileShell } from '../layouts/MobileShell'
import type { AdminUser, AllUser } from '../storage/adminUsersRepo'
import { getAllUsers, getUserIdByEmail, grantAdmin, listAdmins, revokeAdmin } from '../storage/adminUsersRepo'

export function UserManagementPage() {
  const { session } = useAuth()
  const [users, setUsers] = useState<AllUser[]>([])
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [tableLoading, setTableLoading] = useState(false)
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [usersError, setUsersError] = useState<string | null>(null)

  async function refreshUsers(): Promise<void> {
    setTableLoading(true)
    setUsersError(null)
    try {
      const data = await getAllUsers()
      setUsers(data)
    } catch (e: unknown) {
      console.error('getAllUsers error:', e)
      const msg = e instanceof Error ? e.message : '유저 목록을 불러오지 못했습니다.'
      setUsersError(msg)
    } finally {
      setTableLoading(false)
    }
  }

  async function refreshAdmins(): Promise<void> {
    setAdminsLoading(true)
    try {
      const data = await listAdmins()
      setAdmins(data)
    } catch (e: unknown) {
      console.error('listAdmins error:', e)
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
          <List<AdminUser>
            loading={adminsLoading}
            dataSource={admins}
            locale={{ emptyText: '관리자가 없습니다.' }}
            renderItem={(admin) => (
              <List.Item key={admin.id}>
                <Flex vertical gap={2}>
                  <Typography.Text strong>{admin.email ?? '(이메일 없음)'}</Typography.Text>
                  {admin.name && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {admin.name}
                    </Typography.Text>
                  )}
                </Flex>
                <Typography.Text type="secondary">
                  {new Date(admin.granted_at).toLocaleDateString('ko-KR')} 부여
                </Typography.Text>
              </List.Item>
            )}
          />
        </Card>

        <Card
          title="전체 유저 목록"
          extra={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => void refreshUsers()}
              loading={tableLoading}
            >
              새로고침
            </Button>
          }
        >
          {usersError && (
            <Alert
              type="error"
              message={usersError}
              showIcon
              style={{ marginBottom: 12 }}
            />
          )}
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
