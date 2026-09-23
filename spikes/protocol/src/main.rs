use prost::Message;
include!(concat!(env!("OUT_DIR"), "/temporal_heist.v1.rs"));
fn main() {
    let bytes = std::fs::read("/artifacts/ts-input.bin").unwrap();
    let value = Input::decode(bytes.as_slice()).unwrap();
    assert_eq!(value.protocol_major, 1);
    assert_eq!(value.room_epoch, "spike-epoch");
    assert_eq!(value.sequence, 9007199254740991);
    assert_eq!(value.move_x, -1000);
    assert_eq!(value.kind, InputKind::Ready as i32);
    std::fs::write("/artifacts/rust-input.bin", value.encode_to_vec()).unwrap();
    let snapshot = Snapshot {
        protocol_major: 1,
        room_epoch: "spike-epoch".into(),
        server_tick: 456,
        sessions: vec![Session {
            player_id: 1,
            session_id: "session-a".into(),
            connected: true,
            ready: true,
        }],
        room: Some(RoomState {
            phase: RoomPhase::Active as i32,
            attempt: 2,
            started_tick: 123,
            ended_tick: 0,
            deadline_tick: 18123,
            ready_players: 2,
            extraction_players: 1,
            echo_opened_final_door: true,
            failure_reason: FailureReason::Guard as i32,
            failure_hazard_id: 0,
            failure_guard_id: 51,
        }),
        hazards: vec![Hazard {
            id: 41,
            active: true,
            detected_player_id: 2,
        }],
        guards: vec![
            Guard {
                id: 51,
                x_mm: 18_000,
                z_mm: 4_000,
                facing_x: 1_000,
                facing_z: 0,
                state: GuardState::Investigate as i32,
                waypoint_id: 512,
                investigation_target: Some(GuardTarget {
                    x_mm: 18_750,
                    z_mm: 4_000,
                }),
                state_entered_tick: 420,
                search_expires_tick: 600,
            },
            Guard {
                id: 52,
                state: GuardState::Patrol as i32,
                ..Default::default()
            },
            Guard {
                id: 53,
                state: GuardState::Return as i32,
                ..Default::default()
            },
        ],
        ..Default::default()
    };
    std::fs::write("/artifacts/rust-snapshot.bin", snapshot.encode_to_vec()).unwrap();
    println!("Rust decoded TypeScript Ready input and encoded P2 guard state");
}
