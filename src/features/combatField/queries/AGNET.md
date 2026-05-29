# src/features/combatField/queries

entity hitbox와 field summary query 계약을 둔다.

- readback은 작은 area/query summary로 제한한다.
- HP/status/knockback 처리를 위한 typed result shape를 유지한다.
- query delay와 frame boundary를 명시적으로 다룬다.
