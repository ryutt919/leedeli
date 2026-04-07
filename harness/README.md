---
noteId: "30af0ba02ec111f18b765d8e8a841ff3"
tags: []

---

# LeeDeli 하네스 사용 가이드

## 개요

LeeDeli 하네스는 자동화된 피처 구현 및 테스트를 위한 도구입니다. Claude, Codex, Gemini CLI를 지원하며, 실패 시 자동으로 재시도합니다.

## 설치

### 1. Python 의존성

```bash
pip install pyyaml
```

### 2. 에이전트 CLI 설치

#### Claude CLI

```bash
npm install -g @anthropic-ai/claude-code
```

#### Codex CLI

Codex CLI를 설치하고 PATH에 `codex` 명령을 등록하세요.

#### Gemini CLI

Google Gemini CLI를 설치하고 PATH에 `gemini` 명령을 등록하세요.

- 참고: https://ai.google.dev/gemini-api/docs/cli

## 사용법

### 기본 실행

```bash
# 기본 에이전트 (codex) 사용
python harness/runner/main.py

# Claude 에이전트 사용
python harness/runner/main.py --agent claude

# Gemini 에이전트 사용
python harness/runner/main.py --agent gemini
```

### 상태 확인

```bash
python harness/runner/main.py --status
```

출력 예시:

```
=======================================================
  LeeDeli 하네스 상태
=======================================================
  01. [ ] [S1T1] Auth Context (대기)
  02. [I] [S1T2] User Repository (구현완료)
  03. [OK] [S1T3] Schedule Engine (통과)
  04. [X] [S2T1] UI Components (실패)

  요약: 2/4 통과
=======================================================
```

### 특정 피처만 실행

```bash
python harness/runner/main.py --feature S2T1
```

### Gate 모드 (smoke 테스트 포함)

```bash
python harness/runner/main.py --gate
```

### 드라이런 (실제 실행 없이 테스트)

```bash
python harness/runner/main.py --dry-run
```

## 출력 형식

### 진행 상황

```
[하네스] 사이클 1 :: 피처 3/10 [S2T1] Feature Name (카테고리: ui)
[하네스]   시도 1/3 (피처 3/10)
```

### 성공

```
[하네스][성공] 피처 3/10 [S2T1] 통과! (시도 2회) ✓
```

### 실패

```
[하네스][경고] 피처 3/10 [S2T1] 실패 (시도 1/3)
[하네스][평가] 실패 원인 요약:
[하네스][평가] - TypeError: Cannot read property 'map' of undefined
[하네스][평가] - FAIL src/components/Schedule.test.tsx
[하네스][평가] 상세 로그: harness/logs/run_20260402_120000/S2T1_cycle1_attempt1_eval.log
[하네스]   재시도합니다...
```

## 재시도 메커니즘

피처가 실패하면, 다음 시도에서 **이전 실패 정보**가 에이전트에게 전달됩니다:

```
============================================================
이전 평가 실패 요약 (PREVIOUS EVALUATION FAILURE SUMMARY):
============================================================
  ✗ TypeError: Cannot read property 'map' of undefined
  ✗ FAIL src/components/Schedule.test.tsx

상세 평가 로그: harness/logs/run_20260402_120000/S2T1_cycle1_attempt1_eval.log
이전 시도 횟수: 1

============================================================
⚠️  위 실패 원인을 해결한 후 변경사항을 최종 확정하세요.
============================================================
```

## 로그 파일

모든 실행은 `harness/logs/` 디렉토리에 기록됩니다:

```
harness/logs/
├── run_20260402_120000_fast_claude.log      # 전체 실행 로그
└── run_20260402_120000_fast_claude/         # 상세 로그
    ├── S2T1_cycle1_attempt1_coding.log      # 코딩 에이전트 출력
    ├── S2T1_cycle1_attempt1_eval.log        # 평가 결과
    ├── S2T1_cycle1_attempt2_coding.log
    └── S2T1_cycle1_attempt2_eval.log
```

## 환경 변수

하네스는 UTF-8 인코딩을 보장하기 위해 다음 환경 변수를 자동 설정합니다:

```
PYTHONUTF8=1
PYTHONIOENCODING=utf-8
LANG=C.UTF-8
```

Windows에서 인코딩 문제가 발생하지 않도록 모든 출력이 UTF-8로 처리됩니다.

## 설정 파일

`harness/settings/config.yaml`에서 설정을 변경할 수 있습니다:

```yaml
runner:
  default_agent: codex # 기본 에이전트
  supported_agents: [claude, codex, gemini] # 지원 에이전트
  max_cycles: 60 # 최대 사이클 수
  max_retries: 3 # 피처당 최대 재시도 횟수
```

## 문제 해결

### 에이전트를 찾을 수 없음

```
[실행기][오류] 'gemini' 명령을 찾지 못했습니다.
```

→ 에이전트 CLI가 설치되어 있고 PATH에 등록되어 있는지 확인하세요.

### 인코딩 오류

```
UnicodeEncodeError: 'cp949' codec can't encode character
```

→ 최신 버전의 하네스를 사용하고 있는지 확인하세요. UTF-8 처리가 자동으로 됩니다.

### 코딩 에이전트 시간 초과

```
[실행기][오류] 코딩 에이전트 시간 초과: S2T1
```

→ 피처가 너무 복잡하거나 에이전트 응답이 느릴 수 있습니다. `config.yaml`에서 timeout을 늘리거나 피처를 분할하세요.

## 기여

버그 리포트나 개선 제안은 GitHub Issues에 등록해주세요.
