import { Button, Card, Flex, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'

export function UnauthorizedPage() {
  const navigate = useNavigate()

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Card style={{ width: '100%', maxWidth: 420 }}>
        <Flex vertical align="center" gap={12}>
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            권한 없음
          </Typography.Title>
          <Typography.Text type="secondary" style={{ textAlign: 'center' }}>
            이 페이지에 접근할 권한이 없습니다.
          </Typography.Text>
          <Flex gap={8} wrap="wrap" justify="center">
            <Button type="primary" onClick={() => navigate('/', { replace: true })}>
              홈으로
            </Button>
            <Button onClick={() => navigate('/login', { replace: true })}>
              로그인
            </Button>
          </Flex>
        </Flex>
      </Card>
    </div>
  )
}
