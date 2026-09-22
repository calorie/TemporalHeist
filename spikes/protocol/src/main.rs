use prost::Message;
include!(concat!(env!("OUT_DIR"), "/temporal_heist.v1.rs"));
fn main() {
    let bytes = std::fs::read("/artifacts/ts-input.bin").unwrap();
    let value = Input::decode(bytes.as_slice()).unwrap();
    assert_eq!(value.protocol_major, 1);
    assert_eq!(value.room_epoch, "spike-epoch");
    assert_eq!(value.sequence, 9007199254740991);
    assert_eq!(value.move_x, -1000);
    std::fs::write("/artifacts/rust-input.bin", value.encode_to_vec()).unwrap();
    println!("Rust decoded TypeScript input and encoded reply");
}
