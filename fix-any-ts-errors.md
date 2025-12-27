---
noteId: "ddc88540e34511f092fff3d3986a0ce4"
tags: []

---

# 타입 오류 수정 가이드

- 'react' 및 'react-router-dom' 타입 미설치 오류: 위 install-types.cmd 실행
- 'p' 매개변수 any 오류: map/reduce 등에서 (p: 타입) => ... 형태로 명시
- JSX.IntrinsicElements 오류: tsconfig.json의 jsx 설정이 'react-jsx' 또는 'react'인지 확인, 타입 설치 필요
- 기타 타입 오류: 타입스크립트 strict 옵션 확인, 필요한 경우 타입 명시