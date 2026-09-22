fn main() {
    println!("cargo:rerun-if-changed=../../proto/temporal_heist.proto");
    prost_build::Config::new()
        .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
        .compile_protos(&["../../proto/temporal_heist.proto"], &["../../proto"])
        .expect("compile shared protobuf schema");
}
