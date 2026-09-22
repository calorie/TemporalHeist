include!(concat!(env!("OUT_DIR"), "/temporal_heist.v1.rs"));

pub const PROTOCOL_MAJOR: u32 = 1;
pub const TICK_RATE: u64 = 60;
pub const ECHO_DELAY_TICKS: u64 = 600;
pub const HISTORY_TICKS: usize = 3601;
pub const MAX_INPUT_BYTES: usize = 4096;
