fn main() {
    prost_build::compile_protos(&["../../proto/temporal_heist.proto"], &["../../proto"]).unwrap();
}
