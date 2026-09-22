use serde::Deserialize;
use std::collections::{BTreeMap, VecDeque};
use th_protocol::{
    AppliedAction, ECHO_DELAY_TICKS, FailureReason, HISTORY_TICKS, Hazard, Input, InputKind,
    Mechanism, PROTOCOL_MAJOR, Pose, RoomPhase, RoomState, Session, Snapshot,
};

const MOTION_TIMEOUT: u64 = 30;
const SESSION_TIMEOUT: u64 = 300;
const ACTION_LOG: u64 = 3_600;
const ACTION_RANGE: i32 = 1_000;
const ATTEMPT_TICKS: u64 = 18_000;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Map {
    bounds: Bounds,
    radius: i32,
    speed_per_tick: i32,
    spawns: Vec<Spawn>,
    walls: Vec<Rect>,
    doors: Vec<Rect>,
    plates: Vec<Plate>,
    terminals: Vec<Terminal>,
    extraction: Area,
    cameras: Vec<Camera>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Bounds {
    min_x: i32,
    max_x: i32,
    min_z: i32,
    max_z: i32,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Spawn {
    player_id: u32,
    x: i32,
    z: i32,
}
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Rect {
    id: u32,
    min_x: i32,
    max_x: i32,
    min_z: i32,
    max_z: i32,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Area {
    min_x: i32,
    max_x: i32,
    min_z: i32,
    max_z: i32,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Plate {
    id: u32,
    door_id: u32,
    x: i32,
    z: i32,
    radius: i32,
    capability: Capability,
}
#[derive(Deserialize)]
struct Terminal {
    id: u32,
    x: i32,
    z: i32,
    capability: Capability,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Camera {
    id: u32,
    x: i32,
    z: i32,
    direction_x: i32,
    direction_z: i32,
    range: i32,
    half_width: i32,
}
#[derive(Clone, Copy, Deserialize, PartialEq)]
enum Capability {
    None,
    Presence,
    Action,
}

#[derive(Default)]
struct Marks {
    join: Option<u64>,
    motion: Option<u64>,
    action: Option<u64>,
    leave: Option<u64>,
    ready: Option<u64>,
    restart: Option<u64>,
}
impl Marks {
    fn accept(&mut self, kind: InputKind, seq: u64) -> bool {
        let mark = match kind {
            InputKind::Join => &mut self.join,
            InputKind::Motion => &mut self.motion,
            InputKind::Action => &mut self.action,
            InputKind::Leave => &mut self.leave,
            InputKind::Ready => &mut self.ready,
            InputKind::Restart => &mut self.restart,
            InputKind::Unspecified => return false,
        };
        if mark.is_some_and(|old| seq <= old) {
            return false;
        }
        *mark = Some(seq);
        true
    }
}
struct Player {
    session: String,
    connected: bool,
    x: i32,
    z: i32,
    mx: i32,
    mz: i32,
    last_motion: u64,
    last_input: u64,
    marks: Marks,
    history: VecDeque<History>,
    ready: bool,
}
#[derive(Clone, Copy)]
struct History {
    tick: u64,
    x: i32,
    z: i32,
}
struct Scheduled {
    player_id: u32,
    target_id: u32,
    acceptance_tick: u64,
}

pub struct World {
    epoch: String,
    tick: u64,
    map: Map,
    players: BTreeMap<u32, Player>,
    scheduled: BTreeMap<u64, Vec<Scheduled>>,
    actions: VecDeque<AppliedAction>,
    next_action_id: u64,
    plates: Vec<Mechanism>,
    doors: Vec<Mechanism>,
    room_phase: RoomPhase,
    attempt: u32,
    started_tick: u64,
    ended_tick: u64,
    deadline_tick: u64,
    echo_opened_final_door: bool,
    failure_reason: FailureReason,
    failure_hazard_id: u32,
    hazards: Vec<Hazard>,
}

impl World {
    pub fn new(epoch: String) -> Self {
        let map: Map = serde_json::from_str(include_str!("../../../map/facility.json"))
            .expect("valid facility map");
        let plates = map
            .plates
            .iter()
            .map(|p| Mechanism {
                id: p.id,
                ..Default::default()
            })
            .collect();
        let doors = map
            .doors
            .iter()
            .map(|d| Mechanism {
                id: d.id,
                ..Default::default()
            })
            .collect();
        let hazards = map
            .cameras
            .iter()
            .map(|camera| Hazard {
                id: camera.id,
                ..Default::default()
            })
            .collect();
        Self {
            epoch,
            tick: 0,
            map,
            players: BTreeMap::new(),
            scheduled: BTreeMap::new(),
            actions: VecDeque::new(),
            next_action_id: 1,
            plates,
            doors,
            room_phase: RoomPhase::Lobby,
            attempt: 1,
            started_tick: 0,
            ended_tick: 0,
            deadline_tick: 0,
            echo_opened_final_door: false,
            failure_reason: FailureReason::Unspecified,
            failure_hazard_id: 0,
            hazards,
        }
    }
    pub fn step(&mut self, inputs: &[Input]) -> Snapshot {
        self.tick += 1;
        for input in inputs {
            self.apply(input);
        }
        self.expire();
        self.start_if_ready();
        if self.room_phase == RoomPhase::Active {
            self.move_players();
            self.commit_history();
            self.replay_actions();
            self.presence();
            self.surveillance();
            self.update_room_result();
        }
        self.trim_actions();
        self.snapshot()
    }
    pub fn snapshot(&self) -> Snapshot {
        let players = self
            .players
            .iter()
            .filter(|(_, p)| p.connected)
            .map(|(&id, p)| Pose {
                player_id: id,
                x_mm: p.x,
                z_mm: p.z,
                source_tick: self.tick,
                echo: false,
            })
            .collect();
        let sessions = self
            .players
            .iter()
            .map(|(&id, p)| Session {
                player_id: id,
                session_id: p.session.clone(),
                connected: p.connected,
                ready: p.ready,
            })
            .collect();
        let ready_players = self
            .players
            .values()
            .filter(|p| p.connected && p.ready)
            .count() as u32;
        let extraction_players = self.extraction_players();
        Snapshot {
            protocol_major: PROTOCOL_MAJOR,
            room_epoch: self.epoch.clone(),
            server_tick: self.tick,
            players,
            echoes: self.echoes(),
            plates: self.plates.clone(),
            doors: self.doors.clone(),
            actions: self.actions.iter().cloned().collect(),
            sessions,
            room: Some(RoomState {
                phase: self.room_phase as i32,
                attempt: self.attempt,
                started_tick: self.started_tick,
                ended_tick: self.ended_tick,
                deadline_tick: self.deadline_tick,
                ready_players,
                extraction_players,
                echo_opened_final_door: self.echo_opened_final_door,
                failure_reason: self.failure_reason as i32,
                failure_hazard_id: self.failure_hazard_id,
            }),
            hazards: self.hazards.clone(),
        }
    }
    fn apply(&mut self, i: &Input) {
        if i.protocol_major != PROTOCOL_MAJOR
            || i.room_epoch != self.epoch
            || !(1..=2).contains(&i.player_id)
            || i.session_id.is_empty()
        {
            return;
        }
        let Ok(kind) = InputKind::try_from(i.kind) else {
            return;
        };
        if kind == InputKind::Unspecified {
            return;
        }
        if kind == InputKind::Join {
            self.join(i);
            return;
        }
        let mut action = false;
        let mut restart = false;
        {
            let Some(p) = self.players.get_mut(&i.player_id) else {
                return;
            };
            if !p.connected || p.session != i.session_id || !p.marks.accept(kind, i.sequence) {
                return;
            }
            match kind {
                InputKind::Motion
                    if (-1000..=1000).contains(&i.move_x) && (-1000..=1000).contains(&i.move_z) =>
                {
                    p.mx = i.move_x;
                    p.mz = i.move_z;
                    p.last_motion = self.tick;
                    p.last_input = self.tick;
                }
                InputKind::Action => {
                    p.last_input = self.tick;
                    action = self.room_phase == RoomPhase::Active;
                }
                InputKind::Leave => {
                    p.last_input = self.tick;
                    p.connected = false;
                    p.mx = 0;
                    p.mz = 0;
                }
                InputKind::Ready => {
                    p.last_input = self.tick;
                    if self.room_phase == RoomPhase::Lobby {
                        p.ready = true;
                    }
                }
                InputKind::Restart => {
                    p.last_input = self.tick;
                    restart = matches!(self.room_phase, RoomPhase::Won | RoomPhase::Failed);
                }
                _ => {}
            }
        }
        if action {
            self.accept_action(i.player_id, i.target_id);
        }
        if restart {
            self.reset_attempt();
        }
    }
    fn join(&mut self, i: &Input) {
        if let Some(p) = self.players.get_mut(&i.player_id) {
            if p.session == i.session_id {
                if p.marks.accept(InputKind::Join, i.sequence) {
                    p.connected = true;
                    p.last_input = self.tick;
                }
                return;
            }
            if p.connected {
                return;
            }
        }
        let Some(s) = self.map.spawns.iter().find(|s| s.player_id == i.player_id) else {
            return;
        };
        let mut marks = Marks::default();
        marks.accept(InputKind::Join, i.sequence);
        self.players.insert(
            i.player_id,
            Player {
                session: i.session_id.clone(),
                connected: true,
                x: s.x,
                z: s.z,
                mx: 0,
                mz: 0,
                last_motion: self.tick,
                last_input: self.tick,
                marks,
                history: VecDeque::with_capacity(HISTORY_TICKS),
                ready: false,
            },
        );
    }
    fn start_if_ready(&mut self) {
        if self.room_phase != RoomPhase::Lobby {
            return;
        }
        let ready = (1..=2).all(|id| {
            self.players
                .get(&id)
                .is_some_and(|p| p.connected && p.ready)
        });
        if ready {
            self.room_phase = RoomPhase::Active;
            self.started_tick = self.tick;
            self.ended_tick = 0;
            self.deadline_tick = self.tick + ATTEMPT_TICKS;
            self.echo_opened_final_door = false;
            self.failure_reason = FailureReason::Unspecified;
            self.failure_hazard_id = 0;
            self.clear_hazards();
            self.scheduled.clear();
            self.actions.clear();
            for p in self.players.values_mut() {
                p.history.clear();
                p.mx = 0;
                p.mz = 0;
                p.last_motion = self.tick;
            }
        }
    }
    fn update_room_result(&mut self) {
        if self.room_phase != RoomPhase::Active {
            return;
        }
        if self
            .doors
            .iter()
            .any(|door| door.id == 13 && door.echo_presence > 0)
        {
            self.echo_opened_final_door = true;
        }
        if self.echo_opened_final_door && self.extraction_players() == 2 {
            self.room_phase = RoomPhase::Won;
            self.ended_tick = self.tick;
        } else if self.tick >= self.deadline_tick {
            self.room_phase = RoomPhase::Failed;
            self.ended_tick = self.tick;
            self.failure_reason = FailureReason::Timeout;
            self.failure_hazard_id = 0;
        }
    }
    fn extraction_players(&self) -> u32 {
        self.players
            .values()
            .filter(|p| {
                p.connected
                    && p.x >= self.map.extraction.min_x
                    && p.x <= self.map.extraction.max_x
                    && p.z >= self.map.extraction.min_z
                    && p.z <= self.map.extraction.max_z
            })
            .count() as u32
    }
    fn reset_attempt(&mut self) {
        self.room_phase = RoomPhase::Lobby;
        self.attempt += 1;
        self.started_tick = 0;
        self.ended_tick = 0;
        self.deadline_tick = 0;
        self.echo_opened_final_door = false;
        self.failure_reason = FailureReason::Unspecified;
        self.failure_hazard_id = 0;
        self.clear_hazards();
        self.scheduled.clear();
        self.actions.clear();
        self.next_action_id = 1;
        for state in self.plates.iter_mut().chain(&mut self.doors) {
            *state = Mechanism {
                id: state.id,
                ..Default::default()
            };
        }
        for (&id, p) in &mut self.players {
            if let Some(spawn) = self.map.spawns.iter().find(|s| s.player_id == id) {
                p.x = spawn.x;
                p.z = spawn.z;
            }
            p.mx = 0;
            p.mz = 0;
            p.last_motion = self.tick;
            p.last_input = self.tick;
            p.ready = false;
            p.history.clear();
        }
    }
    fn accept_action(&mut self, player_id: u32, target_id: u32) {
        let Some(p) = self.players.get(&player_id) else {
            return;
        };
        let Some(t) = self.map.terminals.iter().find(|t| t.id == target_id) else {
            return;
        };
        let dx = i64::from(p.x - t.x);
        let dz = i64::from(p.z - t.z);
        if dx * dx + dz * dz > i64::from(ACTION_RANGE).pow(2) {
            return;
        }
        let capable = t.capability == Capability::Action;
        self.push_action(player_id, target_id, self.tick, capable, false);
        if capable {
            self.scheduled
                .entry(self.tick + ECHO_DELAY_TICKS)
                .or_default()
                .push(Scheduled {
                    player_id,
                    target_id,
                    acceptance_tick: self.tick,
                });
        }
    }
    fn push_action(
        &mut self,
        player_id: u32,
        target_id: u32,
        acceptance_tick: u64,
        echo_capable: bool,
        echo_pulse: bool,
    ) {
        self.actions.push_back(AppliedAction {
            id: self.next_action_id,
            player_id,
            target_id,
            acceptance_tick,
            echo_capable,
            echo_pulse,
        });
        self.next_action_id += 1;
    }
    fn replay_actions(&mut self) {
        for a in self.scheduled.remove(&self.tick).unwrap_or_default() {
            if self
                .map
                .terminals
                .iter()
                .any(|t| t.id == a.target_id && t.capability == Capability::Action)
            {
                self.push_action(a.player_id, a.target_id, a.acceptance_tick, true, true)
            }
        }
    }
    fn expire(&mut self) {
        for p in self.players.values_mut().filter(|p| p.connected) {
            if self.tick.saturating_sub(p.last_motion) >= MOTION_TIMEOUT {
                p.mx = 0;
                p.mz = 0
            }
            if self.tick.saturating_sub(p.last_input) >= SESSION_TIMEOUT {
                p.connected = false;
                p.mx = 0;
                p.mz = 0
            }
        }
    }
    fn move_players(&mut self) {
        let closed: Vec<Rect> = self
            .map
            .doors
            .iter()
            .copied()
            .filter(|d| !self.doors.iter().any(|s| s.id == d.id && s.active))
            .collect();
        for p in self.players.values_mut().filter(|p| p.connected) {
            let dx = p.mx * self.map.speed_per_tick / 1000;
            let dz = p.mz * self.map.speed_per_tick / 1000;
            if !collides(&self.map, &closed, p.x + dx, p.z) {
                p.x += dx
            }
            if !collides(&self.map, &closed, p.x, p.z + dz) {
                p.z += dz
            }
        }
    }
    fn commit_history(&mut self) {
        for p in self.players.values_mut().filter(|p| p.connected) {
            p.history.push_back(History {
                tick: self.tick,
                x: p.x,
                z: p.z,
            });
            while p.history.len() > HISTORY_TICKS {
                p.history.pop_front();
            }
        }
    }
    fn echoes(&self) -> Vec<Pose> {
        let Some(source) = self.tick.checked_sub(ECHO_DELAY_TICKS) else {
            return vec![];
        };
        self.players
            .iter()
            .filter(|(_, p)| p.connected)
            .filter_map(|(&id, p)| {
                p.history.iter().find(|h| h.tick == source).map(|h| Pose {
                    player_id: id,
                    x_mm: h.x,
                    z_mm: h.z,
                    source_tick: source,
                    echo: true,
                })
            })
            .collect()
    }
    fn presence(&mut self) {
        let live: Vec<_> = self
            .players
            .values()
            .filter(|p| p.connected)
            .map(|p| (p.x, p.z))
            .collect();
        let echoes: Vec<_> = self.echoes().iter().map(|p| (p.x_mm, p.z_mm)).collect();
        for (plate, state) in self.map.plates.iter().zip(&mut self.plates) {
            state.live_presence = live
                .iter()
                .filter(|&&(x, z)| inside(x, z, plate.x, plate.z, plate.radius))
                .count() as u32;
            state.echo_presence = if plate.capability == Capability::Presence {
                echoes
                    .iter()
                    .filter(|&&(x, z)| inside(x, z, plate.x, plate.z, plate.radius))
                    .count() as u32
            } else {
                0
            };
            state.active = state.live_presence + state.echo_presence > 0;
        }
        for door in &mut self.doors {
            let (l, e) = self
                .map
                .plates
                .iter()
                .zip(&self.plates)
                .filter(|(p, _)| p.door_id == door.id)
                .fold((0, 0), |(l, e), (_, p)| {
                    (l + p.live_presence, e + p.echo_presence)
                });
            door.live_presence = l;
            door.echo_presence = e;
            door.active = l + e > 0;
        }
    }
    fn surveillance(&mut self) {
        self.clear_hazards();
        let detection = self.map.cameras.iter().find_map(|camera| {
            self.players
                .iter()
                .filter(|(_, player)| player.connected)
                .find(|(_, player)| camera_contains(camera, player.x, player.z))
                .map(|(&player_id, _)| (camera.id, player_id))
        });
        let Some((camera_id, player_id)) = detection else {
            return;
        };
        if let Some(hazard) = self
            .hazards
            .iter_mut()
            .find(|hazard| hazard.id == camera_id)
        {
            hazard.active = true;
            hazard.detected_player_id = player_id;
        }
        self.room_phase = RoomPhase::Failed;
        self.ended_tick = self.tick;
        self.failure_reason = FailureReason::Surveillance;
        self.failure_hazard_id = camera_id;
    }
    fn clear_hazards(&mut self) {
        for hazard in &mut self.hazards {
            hazard.active = false;
            hazard.detected_player_id = 0;
        }
    }
    fn trim_actions(&mut self) {
        while self
            .actions
            .front()
            .is_some_and(|a| self.tick.saturating_sub(a.acceptance_tick) > ACTION_LOG)
        {
            self.actions.pop_front();
        }
    }
}
fn camera_contains(camera: &Camera, x: i32, z: i32) -> bool {
    let dx = i64::from(x - camera.x);
    let dz = i64::from(z - camera.z);
    let direction_x = i64::from(camera.direction_x);
    let direction_z = i64::from(camera.direction_z);
    let forward = dx * direction_x + dz * direction_z;
    let max_forward = i64::from(camera.range) * 1_000;
    if !(0..=max_forward).contains(&forward) {
        return false;
    }
    let lateral = (dx * direction_z - dz * direction_x).abs();
    lateral * i64::from(camera.range) <= i64::from(camera.half_width) * forward
}
fn collides(map: &Map, doors: &[Rect], x: i32, z: i32) -> bool {
    let r = map.radius;
    if x - r < map.bounds.min_x
        || x + r > map.bounds.max_x
        || z - r < map.bounds.min_z
        || z + r > map.bounds.max_z
    {
        return true;
    }
    map.walls.iter().chain(doors).any(|b| {
        let dx = i64::from(x - x.clamp(b.min_x, b.max_x));
        let dz = i64::from(z - z.clamp(b.min_z, b.max_z));
        dx * dx + dz * dz < i64::from(r).pow(2)
    })
}
fn inside(x: i32, z: i32, cx: i32, cz: i32, r: i32) -> bool {
    let dx = i64::from(x - cx);
    let dz = i64::from(z - cz);
    dx * dx + dz * dz <= i64::from(r).pow(2)
}

#[cfg(test)]
mod tests {
    use super::*;
    use prost::Message;
    use th_protocol::FailureReason;

    fn input(kind: InputKind, seq: u64) -> Input {
        Input {
            protocol_major: PROTOCOL_MAJOR,
            room_epoch: "e".into(),
            player_id: 1,
            session_id: "a".into(),
            sequence: seq,
            kind: kind as i32,
            ..Default::default()
        }
    }
    fn player_input(player_id: u32, session_id: &str, kind: InputKind, seq: u64) -> Input {
        Input {
            protocol_major: PROTOCOL_MAJOR,
            room_epoch: "e".into(),
            player_id,
            session_id: session_id.into(),
            sequence: seq,
            kind: kind as i32,
            ..Default::default()
        }
    }
    fn join_both(w: &mut World) {
        w.step(&[
            player_input(1, "a", InputKind::Join, 1),
            player_input(2, "b", InputKind::Join, 1),
        ]);
    }
    fn start_attempt(w: &mut World) -> Snapshot {
        join_both(w);
        w.step(&[
            player_input(1, "a", InputKind::Ready, 1),
            player_input(2, "b", InputKind::Ready, 1),
        ])
    }
    fn join(w: &mut World) {
        w.step(&[input(InputKind::Join, 1)]);
        w.room_phase = RoomPhase::Active;
        w.started_tick = w.tick;
        w.deadline_tick = w.tick + ATTEMPT_TICKS;
    }
    fn until(w: &mut World, t: u64) -> Snapshot {
        while w.tick < t {
            w.step(&[]);
        }
        w.snapshot()
    }
    fn until_alive(w: &mut World, t: u64) -> Snapshot {
        let mut seq = 2;
        while w.tick < t {
            if w.tick.is_multiple_of(100) {
                w.step(&[input(InputKind::Join, seq)]);
                seq += 1
            } else {
                w.step(&[]);
            }
        }
        w.snapshot()
    }
    fn pose(s: &Snapshot) -> &Pose {
        s.players.iter().find(|p| p.player_id == 1).unwrap()
    }

    #[test]
    fn closed_door_blocks_human() {
        let mut w = World::new("e".into());
        join(&mut w);
        {
            let p = w.players.get_mut(&1).unwrap();
            p.x = 6700;
            p.z = 4000;
        }
        let mut m = input(InputKind::Motion, 1);
        m.move_x = 1000;
        for seq in 1..20 {
            m.sequence = seq;
            w.step(&[m.clone()]);
        }
        assert_eq!(pose(&w.snapshot()).x_mm, 6700);
    }

    #[test]
    fn live_then_echo_presence_opens_door_and_echo_pose_ignores_current_collision() {
        let mut w = World::new("e".into());
        join(&mut w);
        {
            let p = w.players.get_mut(&1).unwrap();
            p.x = 4500;
            p.z = 2500;
        }
        let live = w.step(&[]);
        let t = live.server_tick;
        assert!(live.plates.iter().find(|p| p.id == 21).unwrap().active);
        assert!(live.doors.iter().find(|d| d.id == 11).unwrap().active);
        {
            let p = w.players.get_mut(&1).unwrap();
            p.x = 8000;
            p.z = 2500;
        }
        let echo = until_alive(&mut w, t + ECHO_DELAY_TICKS);
        let p = echo.echoes.iter().find(|p| p.player_id == 1).unwrap();
        assert_eq!((p.x_mm, p.z_mm, p.source_tick), (4500, 2500, t));
        assert_eq!(
            echo.plates
                .iter()
                .find(|p| p.id == 21)
                .unwrap()
                .echo_presence,
            1
        );
        assert!(echo.doors.iter().find(|d| d.id == 11).unwrap().active);
        w.doors.iter_mut().find(|d| d.id == 11).unwrap().active = false;
        assert_eq!(w.echoes()[0].x_mm, 4500);
    }

    #[test]
    fn echo_historical_pose_inside_a_now_closed_door_is_not_redirected() {
        let mut w = World::new("e".into());
        join(&mut w);
        {
            let p = w.players.get_mut(&1).unwrap();
            p.x = 7200;
            p.z = 4000;
        }
        let source_tick = w.step(&[]).server_tick;
        {
            let p = w.players.get_mut(&1).unwrap();
            p.x = 8000;
            p.z = 4000;
        }
        let snapshot = until_alive(&mut w, source_tick + ECHO_DELAY_TICKS);
        let echo = snapshot.echoes.iter().find(|p| p.player_id == 1).unwrap();
        assert_eq!((echo.x_mm, echo.z_mm), (7200, 4000));
        assert!(!snapshot.doors.iter().find(|d| d.id == 11).unwrap().active);
    }

    #[test]
    fn echo_action_is_once_nonrecursive_and_none_has_no_echo_effect() {
        let mut w = World::new("e".into());
        join(&mut w);
        {
            let p = w.players.get_mut(&1).unwrap();
            p.x = 2500;
            p.z = 6000;
        }
        let mut a = input(InputKind::Action, 1);
        a.target_id = 31;
        let t = w.step(&[a.clone(), a.clone()]).server_tick;
        assert_eq!(w.actions.len(), 1);
        until(&mut w, t + 600);
        assert_eq!(w.actions.iter().filter(|a| a.echo_pulse).count(), 1);
        until(&mut w, t + 1200);
        assert_eq!(w.actions.iter().filter(|a| a.echo_pulse).count(), 1);
        {
            let p = w.players.get_mut(&1).unwrap();
            p.x = 3500;
            p.z = 6000;
        }
        a.sequence = 2;
        a.target_id = 32;
        let n = w.step(&[a]).server_tick;
        until(&mut w, n + 600);
        assert!(!w.actions.iter().any(|a| a.target_id == 32 && a.echo_pulse));
    }

    #[test]
    fn validation_watermarks_and_independent_snapshot_boundary() {
        let mut w = World::new("e".into());
        let mut bad = input(InputKind::Join, 1);
        bad.room_epoch = "old".into();
        w.step(&[bad]);
        let mut bad = input(InputKind::Join, 1);
        bad.protocol_major = 2;
        w.step(&[bad]);
        assert!(w.snapshot().players.is_empty());
        join(&mut w);
        let mut m = input(InputKind::Motion, 1);
        m.move_x = 1001;
        let x = pose(&w.step(&[m])).x_mm;
        assert_eq!(pose(&w.step(&[])).x_mm, x);
        {
            let p = w.players.get_mut(&1).unwrap();
            p.x = 2500;
            p.z = 6000;
        }
        let mut a = input(InputKind::Action, 4);
        a.target_id = 999;
        w.step(&[a.clone()]);
        a.target_id = 31;
        w.step(&[a]);
        assert!(w.actions.is_empty());
        let mut m = input(InputKind::Motion, 2);
        m.move_x = 1000;
        let mut a = input(InputKind::Action, 5);
        a.target_id = 31;
        let s = w.step(&[m, a]);
        assert_eq!(s.actions.len(), 1);
        assert_eq!(Snapshot::decode(s.encode_to_vec().as_slice()).unwrap(), s);
    }

    #[test]
    fn disconnect_lifecycle_keeps_scheduled_action_and_new_session_has_no_history() {
        let mut w = World::new("e".into());
        join(&mut w);
        {
            let p = w.players.get_mut(&1).unwrap();
            p.x = 2500;
            p.z = 6000;
        }
        let mut a = input(InputKind::Action, 1);
        a.target_id = 31;
        let t = w.step(&[a]).server_tick;
        let left = w.step(&[input(InputKind::Leave, 1)]);
        assert!(left.players.is_empty() && left.echoes.is_empty() && !left.sessions[0].connected);
        until(&mut w, t + 600);
        assert_eq!(w.actions.iter().filter(|a| a.echo_pulse).count(), 1);
        let same = w.step(&[input(InputKind::Join, 2)]);
        assert!(same.sessions[0].connected);
        w.step(&[input(InputKind::Leave, 2)]);
        let mut replacement = input(InputKind::Join, 1);
        replacement.session_id = "b".into();
        let replaced = w.step(&[replacement]);
        assert_eq!(replaced.sessions[0].session_id, "b");
        assert!(w.players.get(&1).unwrap().history.len() <= 1);
    }

    #[test]
    fn motion_and_session_expire_on_contract_boundaries_and_plate23_counts_are_exposed() {
        let mut w = World::new("e".into());
        join(&mut w);
        let mut m = input(InputKind::Motion, 1);
        m.move_x = 1000;
        let t = w.step(&[m]).server_tick;
        until(&mut w, t + MOTION_TIMEOUT);
        let x = pose(&w.snapshot()).x_mm;
        assert_eq!(pose(&w.step(&[])).x_mm, x);
        until(&mut w, t + SESSION_TIMEOUT);
        assert!(w.snapshot().players.is_empty());
        let mut w = World::new("e".into());
        join(&mut w);
        {
            let p = w.players.get_mut(&1).unwrap();
            p.x = 19500;
            p.z = 2500;
        }
        let s = w.step(&[]);
        assert_eq!(
            s.plates.iter().find(|p| p.id == 23).unwrap().live_presence,
            1
        );
        assert_eq!(
            s.doors.iter().find(|d| d.id == 13).unwrap().live_presence,
            1
        );
    }

    #[test]
    fn room_starts_only_after_both_connected_players_are_ready() {
        let mut w = World::new("e".into());
        let initial = w.snapshot();
        assert_eq!(
            initial.room.as_ref().unwrap().phase,
            RoomPhase::Lobby as i32
        );
        assert_eq!(initial.room.as_ref().unwrap().attempt, 1);

        join_both(&mut w);
        let one_ready = w.step(&[player_input(1, "a", InputKind::Ready, 1)]);
        assert_eq!(
            one_ready.room.as_ref().unwrap().phase,
            RoomPhase::Lobby as i32
        );
        assert_eq!(one_ready.room.as_ref().unwrap().ready_players, 1);
        assert!(
            one_ready
                .sessions
                .iter()
                .find(|s| s.player_id == 1)
                .unwrap()
                .ready
        );

        let active = w.step(&[player_input(2, "b", InputKind::Ready, 1)]);
        let room = active.room.as_ref().unwrap();
        assert_eq!(room.phase, RoomPhase::Active as i32);
        assert_eq!(room.ready_players, 2);
        assert_eq!(room.started_tick, active.server_tick);
        assert_eq!(room.deadline_tick, active.server_tick + ATTEMPT_TICKS);
    }

    #[test]
    fn lobby_and_terminal_phases_freeze_gameplay() {
        let mut w = World::new("e".into());
        join_both(&mut w);
        let spawn = w.players.get(&1).map(|p| (p.x, p.z)).unwrap();
        let mut motion = player_input(1, "a", InputKind::Motion, 1);
        motion.move_x = 1000;
        let lobby = w.step(&[motion.clone()]);
        assert_eq!((pose(&lobby).x_mm, pose(&lobby).z_mm), spawn);
        assert!(w.players.get(&1).unwrap().history.is_empty());

        let started = w.step(&[
            player_input(1, "a", InputKind::Ready, 1),
            player_input(2, "b", InputKind::Ready, 1),
        ]);
        assert_eq!((pose(&started).x_mm, pose(&started).z_mm), spawn);
        motion.sequence = 2;
        let active = w.step(&[motion]);
        assert!(pose(&active).x_mm > spawn.0);
        w.room_phase = RoomPhase::Won;
        let won_x = pose(&w.snapshot()).x_mm;
        assert_eq!(pose(&w.step(&[])).x_mm, won_x);
    }

    #[test]
    fn active_attempt_fails_exactly_at_the_authority_deadline() {
        let mut w = World::new("e".into());
        let active = start_attempt(&mut w);
        let deadline = active.room.as_ref().unwrap().deadline_tick;
        while w.tick + 1 < deadline {
            let seq = w.tick + 2;
            w.step(&[
                player_input(1, "a", InputKind::Join, seq),
                player_input(2, "b", InputKind::Join, seq),
            ]);
        }
        assert_eq!(
            w.snapshot().room.as_ref().unwrap().phase,
            RoomPhase::Active as i32
        );
        let failed = w.step(&[]);
        assert_eq!(failed.server_tick, deadline);
        assert_eq!(
            failed.room.as_ref().unwrap().phase,
            RoomPhase::Failed as i32
        );
        assert_eq!(failed.room.as_ref().unwrap().ended_tick, deadline);
        assert_eq!(
            failed.room.as_ref().unwrap().failure_reason,
            FailureReason::Timeout as i32
        );
        assert_eq!(failed.room.as_ref().unwrap().failure_hazard_id, 0);
    }

    #[test]
    fn live_human_center_inside_camera_cone_fails_immediately() {
        let mut w = World::new("e".into());
        start_attempt(&mut w);
        {
            let player = w.players.get_mut(&1).unwrap();
            player.x = 4_500;
            player.z = 6_000;
        }

        let failed = w.step(&[]);
        let room = failed.room.as_ref().unwrap();
        assert_eq!(room.phase, RoomPhase::Failed as i32);
        assert_eq!(room.ended_tick, failed.server_tick);
        assert_eq!(room.failure_reason, FailureReason::Surveillance as i32);
        assert_eq!(room.failure_hazard_id, 41);
        assert_eq!(failed.hazards.len(), 1);
        assert!(failed.hazards[0].active);
        assert_eq!(failed.hazards[0].detected_player_id, 1);
    }

    #[test]
    fn camera_cone_uses_inclusive_integer_triangular_boundaries() {
        let camera = &World::new("e".into()).map.cameras[0];
        assert!(camera_contains(camera, 5_700, 5_300));
        assert!(!camera_contains(camera, 5_701, 5_300));
        assert!(!camera_contains(camera, 4_500, 7_501));
        assert!(!camera_contains(camera, 4_500, 5_299));
    }

    #[test]
    fn surveillance_ignores_disconnected_humans() {
        let mut w = World::new("e".into());
        start_attempt(&mut w);
        {
            let player = w.players.get_mut(&1).unwrap();
            player.x = 4_500;
            player.z = 6_000;
            player.connected = false;
        }
        let disconnected = w.step(&[]);
        assert_eq!(
            disconnected.room.as_ref().unwrap().phase,
            RoomPhase::Active as i32
        );
        assert!(!disconnected.hazards[0].active);
    }

    #[test]
    fn echo_inside_camera_cone_does_not_trigger_surveillance() {
        let mut w = World::new("e".into());
        start_attempt(&mut w);
        w.tick = ECHO_DELAY_TICKS;
        w.deadline_tick = w.tick + ATTEMPT_TICKS;
        {
            let player = w.players.get_mut(&1).unwrap();
            player.x = 1_500;
            player.z = 2_500;
            player.last_input = w.tick;
            player.history.push_back(History {
                tick: 1,
                x: 4_500,
                z: 6_000,
            });
        }
        w.players.get_mut(&2).unwrap().last_input = w.tick;

        let snapshot = w.step(&[]);
        assert!(
            snapshot
                .echoes
                .iter()
                .any(|echo| { echo.player_id == 1 && echo.x_mm == 4_500 && echo.z_mm == 6_000 })
        );
        assert_eq!(
            snapshot.room.as_ref().unwrap().phase,
            RoomPhase::Active as i32
        );
        assert!(!snapshot.hazards[0].active);
    }

    #[test]
    fn restart_clears_surveillance_failure_and_hazard_state() {
        let mut w = World::new("e".into());
        start_attempt(&mut w);
        {
            let player = w.players.get_mut(&1).unwrap();
            player.x = 4_500;
            player.z = 6_000;
        }
        assert_eq!(
            w.step(&[]).room.as_ref().unwrap().failure_reason,
            FailureReason::Surveillance as i32
        );

        let reset = w.step(&[player_input(1, "a", InputKind::Restart, 2)]);
        let room = reset.room.as_ref().unwrap();
        assert_eq!(room.phase, RoomPhase::Lobby as i32);
        assert_eq!(room.failure_reason, FailureReason::Unspecified as i32);
        assert_eq!(room.failure_hazard_id, 0);
        assert!(
            reset
                .hazards
                .iter()
                .all(|hazard| { !hazard.active && hazard.detected_player_id == 0 })
        );
    }

    #[test]
    fn win_requires_echo_opened_final_door_and_both_players_in_extraction() {
        let mut w = World::new("e".into());
        start_attempt(&mut w);
        {
            let p = w.players.get_mut(&1).unwrap();
            p.x = 19_500;
            p.z = 2_500;
        }
        let source_tick = w.step(&[]).server_tick;
        {
            let p = w.players.get_mut(&1).unwrap();
            p.x = 18_000;
            p.z = 4_000;
        }
        while w.tick < source_tick + ECHO_DELAY_TICKS {
            let seq = w.tick + 2;
            w.step(&[
                player_input(1, "a", InputKind::Join, seq),
                player_input(2, "b", InputKind::Join, seq),
            ]);
        }
        assert!(w.snapshot().room.as_ref().unwrap().echo_opened_final_door);

        for p in w.players.values_mut() {
            p.x = 23_000;
            p.z = if p.session == "a" { 3_500 } else { 4_500 };
        }
        let won = w.step(&[]);
        assert_eq!(won.room.as_ref().unwrap().extraction_players, 2);
        assert_eq!(won.room.as_ref().unwrap().phase, RoomPhase::Won as i32);
        assert_eq!(won.room.as_ref().unwrap().ended_tick, won.server_tick);
    }

    #[test]
    fn terminal_restart_resets_attempt_state_and_requires_readiness_again() {
        let mut w = World::new("e".into());
        start_attempt(&mut w);
        w.echo_opened_final_door = true;
        for p in w.players.values_mut() {
            p.x = 23_000;
            p.z = 4_000;
            p.history.push_back(History {
                tick: 1,
                x: 1,
                z: 1,
            });
        }
        w.scheduled.entry(999).or_default().push(Scheduled {
            player_id: 1,
            target_id: 31,
            acceptance_tick: 1,
        });
        assert_eq!(
            w.step(&[]).room.as_ref().unwrap().phase,
            RoomPhase::Won as i32
        );

        let reset = w.step(&[player_input(1, "a", InputKind::Restart, 1)]);
        let room = reset.room.as_ref().unwrap();
        assert_eq!(room.phase, RoomPhase::Lobby as i32);
        assert_eq!(room.attempt, 2);
        assert_eq!(room.ready_players, 0);
        assert_eq!(room.started_tick, 0);
        assert_eq!(room.deadline_tick, 0);
        assert!(!room.echo_opened_final_door);
        assert!(reset.actions.is_empty());
        assert!(reset.echoes.is_empty());
        assert!(reset.plates.iter().all(|m| !m.active));
        assert!(reset.doors.iter().all(|m| !m.active));
        assert_eq!(
            reset
                .players
                .iter()
                .find(|p| p.player_id == 1)
                .unwrap()
                .x_mm,
            1_500
        );
        assert!(reset.sessions.iter().all(|s| !s.ready));

        let still_lobby = w.step(&[player_input(1, "a", InputKind::Ready, 2)]);
        assert_eq!(
            still_lobby.room.as_ref().unwrap().phase,
            RoomPhase::Lobby as i32
        );
        assert_eq!(still_lobby.room.as_ref().unwrap().ready_players, 1);
    }
}
