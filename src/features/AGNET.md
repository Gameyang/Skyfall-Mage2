# src/features

도메인별 gameplay 구현을 둔다.

- feature는 core state와 command/event를 통해 runtime에 연결된다.
- rendering backend나 DOM node를 직접 소유하지 않는다.
- WebGPU combat field와 연결되는 feature는 query/emitter 경계를 명확히 둔다.
