using System;
using System.Collections.Generic;

namespace Changshan.Combat
{
  // Port of src/entities/player.ts. Each instance owns all of its state (hp, buffers, stamps); nothing is static.
  // Statement order follows the Web source so per-frame traces can be compared with the generated fixture.
  public sealed class Player
  {
    public PlayerTuning Tuning { get; }
    public double X => px;
    public double Y => py;
    public double Z => pz;
    public double VelocityX => vx;
    public double VelocityY => vy;
    public double VelocityZ => vz;
    public double Facing { get; private set; } = Math.PI;
    public PlayerState State { get; private set; } = PlayerState.Move;
    public double StateTime { get; private set; }
    public MoveDefinition Move { get; private set; }
    public double MoveTime { get; private set; }
    public int NormalCount { get; private set; }
    public double Hp { get; private set; }
    public double MaxHp => Tuning.MaxHp;
    public double Musou { get; private set; }
    public double Invulnerable { get; private set; }
    public double Speed { get; private set; }
    public double RunPhase { get; private set; }
    public bool DodgeBack { get; private set; }
    public double GuardTimer { get; private set; } // how long the current guard has been held
    public double ParryTimer { get; private set; } // perfect-guard window right after raising the guard
    public double CounterReady { get; private set; } // counter window after a successful parry
    public IReadOnlyList<PlayerEvent> Events => events;
    public IReadOnlyList<ActiveHit> ActiveHits => activeHits;
    public bool MusouReady => Musou >= Tuning.MusouMax;

    // Exposed for state-isolation checks; not part of the gameplay contract.
    public ChargeButton? BufferedButton => buffered;
    public double JumpBuffer => jumpBuffer;
    public double DodgeBuffer => dodgeBuffer;
    public double MusouBuffer => musouBuffer;

    static readonly PlayerControls Idle = default;

    readonly List<PlayerEvent> events = new List<PlayerEvent>();
    readonly List<ActiveHit> activeHits = new List<ActiveHit>();
    readonly List<uint> stamps = new List<uint>();
    readonly HitStampSource stampSource;
    double px, py, pz, vx, vy, vz;
    double dodgeX, dodgeZ;
    ChargeButton? buffered;
    double bufferAge;
    double jumpBuffer;
    double dodgeBuffer;
    double musouBuffer;
    double moveStartY;

    public Player(PlayerTuning tuning = null, HitStampSource stampSource = null)
    {
      Tuning = tuning ?? PlayerTuning.Default;
      this.stampSource = stampSource ?? new HitStampSource();
      Hp = Tuning.MaxHp;
    }

    public void Reset(double x, double z, double facing)
    {
      px = x; py = 0; pz = z;
      vx = 0; vy = 0; vz = 0;
      Facing = facing;
      State = PlayerState.Move;
      StateTime = 0;
      Move = null;
      MoveTime = 0;
      NormalCount = 0;
      Hp = Tuning.MaxHp;
      Musou = 0;
      Invulnerable = 0;
      Speed = 0;
      GuardTimer = 0;
      ParryTimer = 0;
      CounterReady = 0;
      buffered = null;
      jumpBuffer = 0;
      dodgeBuffer = 0;
      musouBuffer = 0;
      events.Clear();
      activeHits.Clear();
    }

    // Records presses; must also run during hit-stop so input is not eaten.
    public void Queue(in PlayerControls c)
    {
      // Charge outranks the auto-repeat attack pulse so a held attack cannot overwrite a pending C route.
      if (c.Attack && buffered != ChargeButton.Charge) BufferButton(ChargeButton.Attack);
      if (c.Charge) BufferButton(ChargeButton.Charge);
      if (c.Jump) jumpBuffer = Tuning.InputBuffer;
      if (c.Dodge) dodgeBuffer = Tuning.InputBuffer;
      if (c.Musou) musouBuffer = Tuning.InputBuffer;
    }

    // Drops pending one-shot input on pause or focus loss so nothing fires on resume.
    public void ClearQueuedActions()
    {
      buffered = null;
      bufferAge = 0;
      jumpBuffer = 0;
      dodgeBuffer = 0;
      musouBuffer = 0;
    }

    public void Update(double dt, in PlayerControls c, AimFunction aim, Arena arena)
    {
      if (arena == null) throw new ArgumentNullException(nameof(arena));
      events.Clear();
      activeHits.Clear();
      bufferAge += dt;
      if (bufferAge > Tuning.InputBuffer) buffered = null;
      jumpBuffer = Math.Max(0, jumpBuffer - dt);
      dodgeBuffer = Math.Max(0, dodgeBuffer - dt);
      musouBuffer = Math.Max(0, musouBuffer - dt);
      ParryTimer = Math.Max(0, ParryTimer - dt);
      CounterReady = Math.Max(0, CounterReady - dt);
      Queue(c);
      Invulnerable = Math.Max(0, Invulnerable - dt);
      StateTime += dt;

      if (musouBuffer > 0 && MusouReady && CanMusou()) StartMusou();
      else if (c.Guard && CanGuard()) StartGuard();
      else if (dodgeBuffer > 0 && CanDodge()) StartDodge(c);

      switch (State)
      {
        case PlayerState.Move: UpdateMove(dt, c, aim); break;
        case PlayerState.Jump: UpdateJump(dt, c, aim); break;
        case PlayerState.Attack:
        case PlayerState.Musou: UpdateAttack(dt, c, aim); break;
        case PlayerState.Dodge: UpdateDodge(dt, c, aim); break;
        case PlayerState.Guard: UpdateGuard(dt, c, aim); break;
        case PlayerState.Hurt: UpdateStagger(dt, 0.4); break;
        case PlayerState.Down: UpdateStagger(dt, 1.3); break;
        case PlayerState.Dead: UpdateStagger(dt, double.PositiveInfinity); break;
      }
      arena.Constrain(ref px, ref pz, Tuning.BodyRadius);
    }

    // Applies an incoming attack; returns whether damage was actually taken.
    public bool TakeHit(double damage, bool heavy, double fromX, double fromZ)
    {
      if (State == PlayerState.Dead || State == PlayerState.Musou || Invulnerable > 0) return false;
      if (State == PlayerState.Guard && IsGuardingSource(fromX, fromZ))
      {
        if (ParryTimer > 0)
        {
          ParryTimer = 0;
          CounterReady = Tuning.CounterTime;
          GainMusou(12);
          events.Add(PlayerEvent.Simple(PlayerEventType.Parry));
          return false;
        }
        double blocked = heavy ? damage * 0.45 : damage * 0.25;
        Hp = Math.Max(0, Hp - blocked);
        GainMusou(heavy ? 3 : 2);
        events.Add(PlayerEvent.Blocked(blocked, heavy));
        if (Hp <= 0)
        {
          State = PlayerState.Dead;
          StateTime = 0;
          CounterReady = 0;
          events.Add(PlayerEvent.Simple(PlayerEventType.Death));
        }
        return true;
      }
      // An unguarded hit cancels any pending parry counter.
      CounterReady = 0;
      bool armored = State == PlayerState.Attack && Move != null && Move.Armor;
      Hp = Math.Max(0, Hp - (armored ? damage * 0.5 : damage));
      GainMusou(4);
      if (Hp <= 0)
      {
        State = PlayerState.Dead;
        StateTime = 0;
        Move = null;
        CounterReady = 0;
        events.Add(PlayerEvent.Simple(PlayerEventType.Death));
        return true;
      }
      if (armored)
      {
        events.Add(PlayerEvent.WithHeavy(PlayerEventType.Hurt, false));
        return true;
      }
      double dx = px - fromX;
      double dz = pz - fromZ;
      double d = CombatMath.Hypot(dx, dz);
      if (d == 0 || double.IsNaN(d)) d = 1;
      Facing = Math.Atan2(-dx, -dz);
      Move = null;
      NormalCount = 0;
      State = heavy ? PlayerState.Down : PlayerState.Hurt;
      StateTime = 0;
      double knock = heavy ? 6 : 3;
      vx = dx / d * knock; vy = 0; vz = dz / d * knock;
      if (heavy) Invulnerable = 1.6;
      events.Add(PlayerEvent.WithHeavy(PlayerEventType.Hurt, heavy));
      return true;
    }

    // Battle.debug.setHp: tests and dev tooling put the player at a chosen health.
    public void SetHp(double hp)
    {
      if (double.IsNaN(hp) || hp < 0 || hp > Tuning.MaxHp) throw new ArgumentOutOfRangeException(nameof(hp));
      Hp = hp;
    }

    public void GainMusou(double amount)
    {
      if (State == PlayerState.Musou) return;
      Musou = Math.Min(Tuning.MusouMax, Musou + amount);
    }

    void BufferButton(ChargeButton button)
    {
      buffered = button;
      bufferAge = 0;
    }

    bool CanMusou() =>
      (State == PlayerState.Move || State == PlayerState.Attack || State == PlayerState.Guard || State == PlayerState.Hurt) && py < 0.05;

    bool CanGuard()
    {
      if (py >= 0.05) return false;
      if (State == PlayerState.Move || State == PlayerState.Guard) return true;
      return State == PlayerState.Attack && Move != null && !Move.Airborne && MoveTime >= Move.Cancel;
    }

    void StartGuard()
    {
      if (State == PlayerState.Guard) return;
      State = PlayerState.Guard;
      StateTime = 0;
      Move = null;
      MoveTime = 0;
      NormalCount = 0;
      vx = 0; vy = 0; vz = 0;
      GuardTimer = 0;
      ParryTimer = Tuning.ParryTime;
    }

    bool IsGuardingSource(double fromX, double fromZ)
    {
      double dx = fromX - px;
      double dz = fromZ - pz;
      double distance = CombatMath.Hypot(dx, dz);
      if (distance == 0 || double.IsNaN(distance)) distance = 1;
      return (Math.Sin(Facing) * dx + Math.Cos(Facing) * dz) / distance >= Tuning.GuardArcCos;
    }

    bool CanDodge()
    {
      if (State == PlayerState.Move) return py < 0.05;
      var m = Move;
      return State == PlayerState.Attack && m != null && !m.Airborne && MoveTime >= m.Cancel * 0.75 && py < 0.05;
    }

    void StartMusou()
    {
      Musou = 0;
      musouBuffer = 0;
      StartMove(MoveId.MUSOU, Idle, null);
      Invulnerable = Moves.Get(MoveId.MUSOU).Duration + 0.4;
      events.Add(PlayerEvent.Simple(PlayerEventType.MusouStart));
    }

    void StartDodge(in PlayerControls c)
    {
      double len = CombatMath.Hypot(c.MoveX, c.MoveZ);
      DodgeBack = len <= 0.1;
      if (DodgeBack)
      {
        dodgeX = -Math.Sin(Facing);
        dodgeZ = -Math.Cos(Facing);
      }
      else
      {
        dodgeX = c.MoveX / len;
        dodgeZ = c.MoveZ / len;
        Facing = Math.Atan2(dodgeX, dodgeZ);
      }
      State = PlayerState.Dodge;
      StateTime = 0;
      Move = null;
      NormalCount = 0;
      dodgeBuffer = 0;
      buffered = null;
      CounterReady = 0;
      Invulnerable = Math.Max(Invulnerable, 0.34);
      events.Add(PlayerEvent.Simple(PlayerEventType.Dodge));
    }

    void StartJump(in PlayerControls c)
    {
      jumpBuffer = 0;
      State = PlayerState.Jump;
      StateTime = 0;
      Move = null;
      NormalCount = 0;
      vx = c.MoveX * Tuning.RunSpeed * 0.9;
      vy = Tuning.JumpSpeed;
      vz = c.MoveZ * Tuning.RunSpeed * 0.9;
      py = Math.Max(py, 0.01);
      events.Add(PlayerEvent.Simple(PlayerEventType.Jump));
    }

    void StartMove(MoveId id, in PlayerControls c, AimFunction aim)
    {
      var m = Moves.Get(id);
      Move = m;
      MoveTime = 0;
      State = id == MoveId.MUSOU ? PlayerState.Musou : PlayerState.Attack;
      StateTime = 0;
      stamps.Clear();
      for (int i = 0; i < m.Hits.Count; i++) stamps.Add(stampSource.Next());
      NormalCount = m.Index;
      buffered = null;
      moveStartY = py;
      vx = 0; vy = 0; vz = 0;
      double len = CombatMath.Hypot(c.MoveX, c.MoveZ);
      if (len > 0.2) Facing = Math.Atan2(c.MoveX, c.MoveZ);
      else if (aim != null && aim(px, pz, 6.5, out double tx, out double tz)) Facing = Math.Atan2(tx - px, tz - pz);
      events.Add(PlayerEvent.MoveStarted(id));
    }

    void ToMove()
    {
      State = PlayerState.Move;
      StateTime = 0;
      Move = null;
    }

    void UpdateMove(double dt, in PlayerControls c, AimFunction aim)
    {
      vx = CombatMath.Damp(vx, c.MoveX * Tuning.RunSpeed, 12, dt);
      vz = CombatMath.Damp(vz, c.MoveZ * Tuning.RunSpeed, 12, dt);
      px += vx * dt;
      pz += vz * dt;
      Speed = CombatMath.Hypot(vx, vz);
      if (c.MoveX * c.MoveX + c.MoveZ * c.MoveZ > 0.01) Facing = CombatMath.DampAngle(Facing, Math.Atan2(c.MoveX, c.MoveZ), 14, dt);
      RunPhase += Speed * dt * 1.25;
      if (CounterReady > 0 && buffered == ChargeButton.Attack)
      {
        CounterReady = 0;
        StartMove(MoveId.COUNTER, c, aim);
        return;
      }
      if (jumpBuffer > 0)
      {
        StartJump(c);
        return;
      }
      if (buffered != null)
      {
        var next = Combo.NextMove(null, 0, false, true, buffered.Value);
        if (next != null) StartMove(next.Value, c, aim);
      }
    }

    void UpdateGuard(double dt, in PlayerControls c, AimFunction aim)
    {
      GuardTimer += dt;
      Speed = 0;
      if (c.MoveX * c.MoveX + c.MoveZ * c.MoveZ > 0.01) Facing = CombatMath.DampAngle(Facing, Math.Atan2(c.MoveX, c.MoveZ), 10, dt);
      if (CounterReady > 0 && buffered == ChargeButton.Attack)
      {
        CounterReady = 0;
        StartMove(MoveId.COUNTER, c, aim);
        return;
      }
      if (!c.Guard)
      {
        ToMove();
        return;
      }
      if (dodgeBuffer > 0) StartDodge(c);
    }

    void UpdateJump(double dt, in PlayerControls c, AimFunction aim)
    {
      vx = CombatMath.Damp(vx, c.MoveX * Tuning.RunSpeed * 0.85, 4, dt);
      vz = CombatMath.Damp(vz, c.MoveZ * Tuning.RunSpeed * 0.85, 4, dt);
      vy -= Tuning.Gravity * dt;
      px += vx * dt;
      py += vy * dt;
      pz += vz * dt;
      Speed = CombatMath.Hypot(vx, vz);
      if (c.MoveX * c.MoveX + c.MoveZ * c.MoveZ > 0.01) Facing = CombatMath.DampAngle(Facing, Math.Atan2(c.MoveX, c.MoveZ), 6, dt);
      if (buffered != null && py > 0.4)
      {
        var next = Combo.NextMove(null, 0, true, true, buffered.Value);
        if (next != null)
        {
          StartMove(next.Value, c, aim);
          return;
        }
      }
      if (py <= 0)
      {
        py = 0;
        vx = 0; vy = 0; vz = 0;
        events.Add(PlayerEvent.WithHeavy(PlayerEventType.Land, false));
        ToMove();
      }
    }

    void UpdateAttack(double dt, in PlayerControls c, AimFunction aim)
    {
      var m = Move;
      if (m == null)
      {
        ToMove();
        return;
      }
      double prev = MoveTime;
      double t = MoveTime += dt;
      bool hasInput = c.MoveX * c.MoveX + c.MoveZ * c.MoveZ > 0.01;
      if (State == PlayerState.Musou)
      {
        // Slow walk during musou to drag the dragon into the crowd.
        px += c.MoveX * Tuning.MusouWalkSpeed * dt;
        pz += c.MoveZ * Tuning.MusouWalkSpeed * dt;
        if (hasInput) Facing = CombatMath.DampAngle(Facing, Math.Atan2(c.MoveX, c.MoveZ), 4, dt);
      }
      else if (t < 0.1 && hasInput)
      {
        Facing = CombatMath.DampAngle(Facing, Math.Atan2(c.MoveX, c.MoveZ), 18, dt);
      }

      double fx = Math.Sin(Facing);
      double fz = Math.Cos(Facing);
      for (int i = 0; i < m.Lunges.Count; i++)
      {
        var l = m.Lunges[i];
        double step = (CombatMath.Smoothstep(l.T0, l.T1, t) - CombatMath.Smoothstep(l.T0, l.T1, prev)) * l.Distance;
        if (step > 0)
        {
          px += fx * step;
          pz += fz * step;
        }
      }

      if (m.HasHeight)
      {
        double k = m.SampleHeight(t);
        bool wasAir = py > 0.05;
        py = Math.Max(0, m.HeightRelative ? moveStartY * k : k);
        if (wasAir && py <= 0.05) events.Add(PlayerEvent.WithHeavy(PlayerEventType.Land, true));
      }

      // Web tests id.startsWith('C'), which includes COUNTER.
      bool heavySwing = m.IsCharge || m.Id == MoveId.COUNTER || m.Id == MoveId.N6 || m.Id == MoveId.MUSOU;
      for (int i = 0; i < m.Swings.Count; i++)
        if (prev < m.Swings[i] && t >= m.Swings[i]) events.Add(PlayerEvent.WithHeavy(PlayerEventType.Swing, heavySwing));

      for (int i = 0; i < m.Hits.Count; i++)
      {
        var w = m.Hits[i];
        if (t < w.T0 || prev > w.T1) continue;
        if (w.Fx != HitFx.None && prev < w.T0) events.Add(PlayerEvent.FxAt(w.Fx, px, pz, w.Shape.Range));
        activeHits.Add(new ActiveHit(m.Id, w, i, stamps[i], px, py, pz, Facing));
      }

      if (State == PlayerState.Attack && t >= m.Cancel)
      {
        if (buffered != null)
        {
          var next = Combo.NextMove(m.Id, NormalCount, py > 0.3, true, buffered.Value);
          if (next != null)
          {
            StartMove(next.Value, c, aim);
            return;
          }
        }
        if (jumpBuffer > 0 && !m.Airborne && py <= 0.01)
        {
          StartJump(c);
          return;
        }
        double lastHit = m.Hits.Count > 0 ? m.Hits[m.Hits.Count - 1].T1 : 0;
        if (buffered == null && !m.Airborne && py <= 0.01 && hasInput && t >= lastHit)
        {
          ToMove();
          return;
        }
      }

      if (t >= m.Duration)
      {
        Move = null;
        NormalCount = 0;
        if (py > 0.02)
        {
          State = PlayerState.Jump;
          StateTime = 0;
          vx = 0; vy = 0; vz = 0;
        }
        else ToMove();
      }
    }

    void UpdateDodge(double dt, in PlayerControls c, AimFunction aim)
    {
      double v = Tuning.DodgeSpeed * (1 - CombatMath.Smoothstep(0.08, Tuning.DodgeTime, StateTime));
      px += dodgeX * v * dt;
      pz += dodgeZ * v * dt;
      Speed = v;
      if (StateTime >= Tuning.DashCancelTime && buffered == ChargeButton.Attack)
      {
        StartMove(MoveId.DASH, c, aim);
        return;
      }
      if (StateTime >= Tuning.DodgeTime) ToMove();
    }

    void UpdateStagger(double dt, double duration)
    {
      vx = CombatMath.Damp(vx, 0, 5, dt);
      vz = CombatMath.Damp(vz, 0, 5, dt);
      px += vx * dt;
      pz += vz * dt;
      if (py > 0)
      {
        vy -= Tuning.Gravity * dt;
        py = Math.Max(0, py + vy * dt);
      }
      Speed = 0;
      if (StateTime >= duration)
      {
        if (State == PlayerState.Down) Invulnerable = Math.Max(Invulnerable, 0.8);
        ToMove();
      }
    }
  }
}
