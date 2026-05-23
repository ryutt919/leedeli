import { Button, Card, Form, Input, Typography, message, Flex } from 'antd'
import { useState } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../auth/AuthContext'

/**
 * 로그인 / 회원가입 페이지
 * - 이메일 + 비밀번호 기반 인증
 * - 회원가입 시 확인 이메일 발송(Supabase 기본 설정에 따라)
 * - 이미 로그인된 상태면 홈으로 redirect
 */
export function LoginPage() {
    const { session } = useAuth()
    const [loading, setLoading] = useState(false)
    const [isSignUp, setIsSignUp] = useState(false)
    const nav = useNavigate()
    const location = useLocation()
    const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/'

    // 이미 로그인된 사용자는 홈으로
    if (session) return <Navigate to="/" replace />

    const onFinish = async (values: { email: string; password: string; name?: string }) => {
        setLoading(true)
        const { email, password, name } = values

        if (isSignUp) {
            // 회원가입 (이름을 user_metadata에 저장)
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { name: name?.trim() || email.split('@')[0] } },
            })
            if (error) {
                message.error(`회원가입 실패: ${error.message}`)
            } else {
                message.success('회원가입 성공! 로그인해 주세요.')
                setIsSignUp(false)
            }
        } else {
            // 로그인
            const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) {
                message.error(`로그인 실패: ${error.message}`)
            } else {
                const userId = signInData.user?.id
                const { data: adminRow } = await supabase
                    .from('admin_users')
                    .select('id')
                    .eq('user_id', userId)
                    .is('revoked_at', null)
                    .maybeSingle()
                if (!adminRow) {
                    await supabase.auth.signOut()
                    message.error('관리자 권한이 없습니다. 접근이 거부되었습니다.')
                } else {
                    message.success('로그인 성공!')
                    nav(from, { replace: true })
                }
            }
        }

        setLoading(false)
    }

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
                padding: 16,
            }}
        >
            <Card
                style={{
                    width: '100%',
                    maxWidth: 400,
                    borderRadius: 16,
                    boxShadow: '0 0 40px rgba(66, 243, 66, 0.15), 0 8px 32px rgba(0,0,0,0.4)',
                    border: '1px solid rgba(66, 243, 66, 0.2)',
                    background: 'rgba(20, 20, 20, 0.95)',
                }}
            >
                <Flex vertical align="center" gap={8} style={{ marginBottom: 24 }}>
                    <Typography.Title
                        level={2}
                        style={{
                            margin: 0,
                            color: '#42f342',
                            fontWeight: 800,
                            letterSpacing: 2,
                            WebkitTextStroke: '0.5px rgba(0,0,0,0.3)',
                        }}
                    >
                        LEE DELI
                    </Typography.Title>
                    <Typography.Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                        {isSignUp ? '새 계정을 만드세요' : '계정에 로그인하세요'}
                    </Typography.Text>
                </Flex>

                <Form layout="vertical" onFinish={onFinish}>
                    {isSignUp && (
                        <Form.Item
                            name="name"
                            label={<span style={{ color: 'rgba(255,255,255,0.7)' }}>이름</span>}
                            rules={[{ required: true, message: '이름을 입력해주세요' }]}
                        >
                            <Input
                                placeholder="홍길동"
                                size="large"
                                autoComplete="name"
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    borderColor: 'rgba(255,255,255,0.15)',
                                    color: '#fff',
                                }}
                            />
                        </Form.Item>
                    )}

                    <Form.Item
                        name="email"
                        label={<span style={{ color: 'rgba(255,255,255,0.7)' }}>이메일</span>}
                        rules={[
                            { required: true, message: '이메일을 입력해주세요' },
                            { type: 'email', message: '올바른 이메일 형식을 입력해주세요' },
                        ]}
                    >
                        <Input
                            placeholder="email@example.com"
                            size="large"
                            autoComplete="email"
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                borderColor: 'rgba(255,255,255,0.15)',
                                color: '#fff',
                            }}
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        label={<span style={{ color: 'rgba(255,255,255,0.7)' }}>비밀번호</span>}
                        rules={[
                            { required: true, message: '비밀번호를 입력해주세요' },
                            { min: 6, message: '비밀번호는 6자 이상이어야 합니다' },
                        ]}
                    >
                        <Input.Password
                            placeholder="비밀번호"
                            size="large"
                            autoComplete={isSignUp ? 'new-password' : 'current-password'}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                borderColor: 'rgba(255,255,255,0.15)',
                                color: '#fff',
                            }}
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 12 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            block
                            size="large"
                            style={{
                                background: '#42f342',
                                borderColor: '#42f342',
                                color: '#000',
                                fontWeight: 700,
                                height: 48,
                                fontSize: 16,
                                boxShadow: '0 0 20px rgba(66, 243, 66, 0.3)',
                            }}
                        >
                            {isSignUp ? '회원가입' : '로그인'}
                        </Button>
                    </Form.Item>
                </Form>

                <Flex justify="center">
                    <Button
                        type="link"
                        onClick={() => setIsSignUp(!isSignUp)}
                        style={{ color: 'rgba(66, 243, 66, 0.7)', fontSize: 13 }}
                    >
                        {isSignUp ? '이미 계정이 있나요? 로그인' : '계정이 없나요? 회원가입'}
                    </Button>
                </Flex>
            </Card>
        </div>
    )
}
