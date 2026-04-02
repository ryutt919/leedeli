import { Button, Card, Flex, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'

export function UnauthorizedPage(): JSX.Element {
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
        <Flex vertical align="center" gap={8}>
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            Unauthorized
          </Typography.Title>
          <Typography.Text type="secondary" style={{ textAlign: 'center' }}>
            You do not have permission to access this page.
          </Typography.Text>
          <Button type="primary" onClick={() => navigate('/', { replace: true })}>
            Go Home
          </Button>
        </Flex>
      </Card>
    </div>
  )
}
