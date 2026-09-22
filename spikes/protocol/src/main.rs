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
        }),
        ..Default::default()
    };
    std::fs::write("/artifacts/rust-snapshot.bin", snapshot.encode_to_vec()).unwrap();
    println!("Rust decoded TypeScript Ready input and encoded P1 room state");
}
