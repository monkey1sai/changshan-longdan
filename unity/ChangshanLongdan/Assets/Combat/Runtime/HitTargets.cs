using System;
using System.Collections.Generic;

namespace Changshan.Combat
{
  // Port of src/entities/enemies.ts EnemyStore without the AI (E08): SoA state in single precision like the Web's
  // Float32Array (every store rounds the same way), the spatial hash (hit order and rng consumption order follow the
  // Web), the reaction state machine (flinch, air, knockback, down, get-up), the soldier/captain rules, separation and
  // the arena constraint. A soldier that is not reacting stands like the Web's Formation state (brakes, turns toward
  // the player); a reaction that ends returns there instead of to the AI's Engage/March.
  public sealed class HitTargets
  {
    public const double BodyRadius = 0.42;
    public const double Gravity = 25;
    public const uint DefaultSeed = 7;
    const double Tau = Math.PI * 2;

    readonly float[] x, y, z, vx, vy, vz, yaw, hp, maxHp, stateTime, flash, phase, moveBlend, spin, spinVel, cooldown, scale, side;
    readonly EnemyState[] state;
    readonly EnemyKind[] kind;
    readonly bool[] alive;
    readonly SpatialHash hash = new SpatialHash(2);
    readonly List<int> candidates = new List<int>();
    readonly List<int> neighbors = new List<int>();
    readonly List<KillInfo> kills = new List<KillInfo>();
    readonly Mulberry32 rng;

    public int Capacity { get; }
    public int Count { get; private set; }
    public int AliveCount { get; private set; }
    // E05 reference mode: soldiers never run update() in the Web hit-parity harness, so Step does nothing while this is
    // set (hits still set reactions and velocities; they are just never integrated).
    public bool Static { get; set; }
    public IReadOnlyList<KillInfo> Kills => kills; // soldiers killed since ClearKills (CombatSimulation drains it each step)

    // The Web seeds the rng once per EnemyStore and does not reseed on reset; the same here (Reset continues the stream).
    public HitTargets(int capacity, uint seed = DefaultSeed)
    {
      if (capacity < 0) throw new ArgumentOutOfRangeException(nameof(capacity));
      Capacity = capacity;
      float[] F() => new float[capacity];
      x = F(); y = F(); z = F(); vx = F(); vy = F(); vz = F(); yaw = F(); hp = F(); maxHp = F(); stateTime = F(); flash = F();
      phase = F(); moveBlend = F(); spin = F(); spinVel = F(); cooldown = F(); scale = F(); side = F();
      state = new EnemyState[capacity];
      kind = new EnemyKind[capacity];
      alive = new bool[capacity];
      rng = new Mulberry32(seed);
    }

    // EnemyStore.reset: the rng is consumed in the Web's order (hp, state time, phase, cooldown, side, scale).
    public void Reset(IReadOnlyList<Spawn> spawns)
    {
      if (spawns == null) throw new ArgumentNullException(nameof(spawns));
      if (spawns.Count > Capacity) throw new InvalidOperationException($"HIT_TARGETS_FULL: {spawns.Count} spawns, capacity {Capacity}");
      Count = AliveCount = spawns.Count;
      kills.Clear();
      for (int i = 0; i < spawns.Count; i++)
      {
        var s = spawns[i];
        bool captain = s.Kind == EnemyKind.Captain;
        x[i] = (float)s.X;
        y[i] = 0;
        z[i] = (float)s.Z;
        vx[i] = vy[i] = vz[i] = 0;
        yaw[i] = (float)s.Yaw;
        kind[i] = s.Kind;
        hp[i] = (float)(captain ? 230 : rng.Range(40, 52)); // normal difficulty: captainHp 1
        maxHp[i] = hp[i];
        state[i] = EnemyState.Idle;
        stateTime[i] = (float)(rng.Next() * 2);
        flash[i] = 0;
        phase[i] = (float)(rng.Next() * Tau);
        moveBlend[i] = 0;
        spin[i] = spinVel[i] = 0;
        cooldown[i] = (float)rng.Range(0.5, 3);
        side[i] = rng.Next() < 0.5 ? -1 : 1;
        scale[i] = (float)(captain ? 1.22 : rng.Range(0.96, 1.04));
        alive[i] = true;
      }
      RebuildHash();
    }

    // A static target with explicit size and health, no rng (E05 dummies and fixtures). Standing soldier, facing +z.
    public int Add(double px, double py, double pz, double size, float health)
    {
      if (Count == Capacity) throw new InvalidOperationException($"HIT_TARGETS_FULL: capacity {Capacity}");
      if (!(size > 0) || double.IsInfinity(size)) throw new ArgumentOutOfRangeException(nameof(size));
      if (!(health > 0) || float.IsInfinity(health)) throw new ArgumentOutOfRangeException(nameof(health));
      int i = Count++;
      x[i] = (float)px;
      y[i] = (float)py;
      z[i] = (float)pz;
      vx[i] = vy[i] = vz[i] = yaw[i] = stateTime[i] = flash[i] = phase[i] = moveBlend[i] = spin[i] = spinVel[i] = cooldown[i] = 0;
      scale[i] = (float)size;
      side[i] = 1;
      hp[i] = maxHp[i] = health;
      state[i] = EnemyState.Idle;
      kind[i] = EnemyKind.Spear;
      alive[i] = true;
      AliveCount++;
      hash.Insert(i, x[i], z[i]);
      return i;
    }

    // Fixture overrides after Reset (the Web harness writes the typed arrays the same way), then RebuildHash.
    public void SetY(int i, double value) => y[Check(i)] = (float)value;
    public void SetScale(int i, double value) => scale[Check(i)] = (float)value;
    public void SetHp(int i, float value) => hp[Check(i)] = maxHp[i] = value;

    public void RebuildHash()
    {
      hash.Clear();
      for (int i = 0; i < Count; i++) if (alive[i]) hash.Insert(i, x[i], z[i]);
    }

    public void Clear()
    {
      Count = AliveCount = 0;
      kills.Clear();
      hash.Clear();
    }

    public void ClearKills() => kills.Clear();

    public double X(int i) => x[Check(i)];
    public double Y(int i) => y[Check(i)];
    public double Z(int i) => z[Check(i)];
    public double Vx(int i) => vx[Check(i)];
    public double Vy(int i) => vy[Check(i)];
    public double Vz(int i) => vz[Check(i)];
    public double Yaw(int i) => yaw[Check(i)];
    public double Scale(int i) => scale[Check(i)];
    public double StateTime(int i) => stateTime[Check(i)];
    public double Flash(int i) => flash[Check(i)];
    public double Spin(int i) => spin[Check(i)];
    public double SpinVel(int i) => spinVel[Check(i)];
    public float Hp(int i) => hp[Check(i)];
    public float MaxHp(int i) => maxHp[Check(i)];
    public bool Alive(int i) => alive[Check(i)];
    public EnemyState State(int i) => state[Check(i)];
    public EnemyKind Kind(int i) => kind[Check(i)];
    public double Radius(int i) => BodyRadius * scale[Check(i)];

    // Candidates in the Web's spatial-hash order (applyHit's loop order).
    public List<int> Query(double px, double pz, double radius, List<int> output) => hash.Query(px, pz, radius, output);

    // Port of EnemyStore.nearest: the closest living target strictly within maxDist in hash order, or -1.
    public int Nearest(double px, double pz, double maxDist)
    {
      int best = -1;
      double bestD = maxDist * maxDist;
      foreach (int i in hash.Query(px, pz, maxDist, neighbors))
      {
        if (!alive[i]) continue;
        double dx = x[i] - px, dz = z[i] - pz;
        double d2 = dx * dx + dz * dz;
        if (d2 < bestD)
        {
          bestD = d2;
          best = i;
        }
      }
      return best;
    }

    // EnemyStore.update without engagement and tokens (E08): timers, the reaction steps, separation and the arena.
    public void Step(double dt, double px, double py, double pz, Arena arena)
    {
      if (arena == null) throw new ArgumentNullException(nameof(arena));
      if (Static) return;
      for (int i = 0; i < Count; i++)
      {
        if (!alive[i]) continue;
        flash[i] = (float)Math.Max(0, flash[i] - dt * 9);
        cooldown[i] = (float)(cooldown[i] - dt);
        stateTime[i] = (float)(stateTime[i] + dt);
        StepOne(i, dt, px, pz);
        double speed = CombatMath.Hypot(vx[i], vz[i]);
        moveBlend[i] = (float)CombatMath.Damp(moveBlend[i], Math.Min(1, speed / 3.5), 10, dt);
        phase[i] = (float)(phase[i] + speed * dt * 2.3);
      }
      RebuildHash();
      Separate(px, pz, arena);
    }

    void StepOne(int i, double dt, double px, double pz)
    {
      float t = stateTime[i];
      switch (state[i])
      {
        case EnemyState.Idle:
        {
          // The Web's Formation state: brake and face the player when within ~45 m. The engagement hand-off is E08.
          Brake(i, dt, 8);
          double dx = px - x[i], dz = pz - z[i];
          if (dx * dx + dz * dz < 2000) yaw[i] = (float)CombatMath.DampAngle(yaw[i], Math.Atan2(dx, dz), 1.5, dt);
          break;
        }
        case EnemyState.Flinch:
          Brake(i, dt, 5);
          if (t >= 0.42) Recover(i);
          break;
        case EnemyState.Air:
          vy[i] = (float)(vy[i] - Gravity * dt);
          x[i] = (float)(x[i] + vx[i] * dt);
          y[i] = (float)(y[i] + vy[i] * dt);
          z[i] = (float)(z[i] + vz[i] * dt);
          spin[i] = (float)(spin[i] + spinVel[i] * dt);
          if (y[i] <= 0 && vy[i] <= 0)
          {
            y[i] = 0;
            vy[i] = 0;
            vx[i] = (float)(vx[i] * 0.35);
            vz[i] = (float)(vz[i] * 0.35);
            SetState(i, EnemyState.Down);
          }
          return; // airborne soldiers integrate themselves
        case EnemyState.Knockback:
          Brake(i, dt, 5);
          if (t >= 0.4) Recover(i);
          break;
        case EnemyState.Down:
          Brake(i, dt, 6);
          if (t >= 1.15) SetState(i, EnemyState.Getup);
          break;
        case EnemyState.Getup:
          Brake(i, dt, 10);
          if (t >= 0.5) Recover(i);
          break;
      }
      x[i] = (float)(x[i] + vx[i] * dt);
      z[i] = (float)(z[i] + vz[i] * dt);
    }

    // EnemyStore.separate: grounded soldiers push each other apart, keep 0.95 m from the player, and stay in the arena.
    void Separate(double px, double pz, Arena arena)
    {
      for (int i = 0; i < Count; i++)
      {
        if (!alive[i]) continue;
        if (state[i] != EnemyState.Air)
        {
          foreach (int j in hash.Query(x[i], z[i], 1.1, neighbors))
          {
            if (j <= i || !alive[j] || state[j] == EnemyState.Air) continue;
            // Read the floats as doubles before combining them: the Web subtracts Float32Array elements in double
            // (exact), while a float - float in C# may round to single precision on some runtimes.
            double xi = x[i], zi = z[i], xj = x[j], zj = z[j], si = scale[i], sj = scale[j];
            double dx = xj - xi, dz = zj - zi;
            double d2 = dx * dx + dz * dz;
            double minD = (si + sj) * BodyRadius;
            if (d2 >= minD * minD) continue;
            if (d2 < 1e-6)
            {
              x[j] = (float)(x[j] + 0.02 * side[j]);
              continue;
            }
            double d = Math.Sqrt(d2);
            double push = ((minD - d) / d) * 0.5;
            x[i] = (float)(x[i] - dx * push);
            z[i] = (float)(z[i] - dz * push);
            x[j] = (float)(x[j] + dx * push);
            z[j] = (float)(z[j] + dz * push);
          }
          double ddx = (double)x[i] - px, ddz = (double)z[i] - pz;
          double dd2 = ddx * ddx + ddz * ddz;
          if (dd2 < 0.9 && dd2 > 1e-6)
          {
            double d = Math.Sqrt(dd2);
            x[i] = (float)(px + (ddx / d) * 0.95);
            z[i] = (float)(pz + (ddz / d) * 0.95);
          }
        }
        double cx = x[i], cz = z[i];
        arena.Constrain(ref cx, ref cz, BodyRadius * scale[i]);
        x[i] = (float)cx;
        z[i] = (float)cz;
      }
    }

    // EnemyStore.damage: health, flash, facing and the reaction; a kill records how the body flies. Returns killed.
    internal bool Damage(int i, HitWindow w, double dirX, double dirZ)
    {
      bool captain = kind[i] == EnemyKind.Captain;
      double push = w.Push * (captain ? 0.6 : 1);
      double lift = captain ? 0.7 : 1;
      hp[i] = (float)(hp[i] - w.Damage);
      flash[i] = 1;
      if (hp[i] <= 0)
      {
        alive[i] = false;
        state[i] = EnemyState.Dead;
        AliveCount--;
        kills.Add(new KillInfo(i, x[i], y[i], z[i], dirX * push * 0.8 + vx[i] * 0.3, Math.Max(w.Lift, 2.5) * 0.8,
          dirZ * push * 0.8 + vz[i] * 0.3, yaw[i], spin[i], kind[i]));
        return true;
      }
      bool airborne = state[i] == EnemyState.Air;
      yaw[i] = (float)Math.Atan2(-dirX, -dirZ); // face the attacker, fly backwards
      switch (w.Reaction)
      {
        case Reaction.Flinch:
          if (airborne)
          {
            vy[i] = (float)Math.Max(vy[i], 3.2);
            vx[i] = (float)(dirX * push * 0.4);
            vz[i] = (float)(dirZ * push * 0.4);
          }
          else
          {
            // The Web's captain-in-Windup 50 % chance to shrug a flinch needs the Windup state (E08) and cannot occur here.
            SetState(i, EnemyState.Flinch);
            vx[i] = (float)(dirX * push);
            vz[i] = (float)(dirZ * push);
          }
          break;
        case Reaction.Launch:
          vy[i] = (float)(airborne ? Math.Max(vy[i], w.Lift * 0.75) : w.Lift * lift);
          vx[i] = (float)(dirX * push);
          vz[i] = (float)(dirZ * push);
          spinVel[i] = (float)-rng.Range(3, 6);
          if (!airborne) EnterAir(i);
          break;
        case Reaction.Knockback:
          vx[i] = (float)(dirX * push);
          vz[i] = (float)(dirZ * push);
          if (airborne) vy[i] = (float)Math.Max(vy[i], 2.5);
          else SetState(i, EnemyState.Knockback);
          break;
        case Reaction.Blowaway:
          vy[i] = (float)(Math.Max(w.Lift, 3) * lift);
          vx[i] = (float)(dirX * push);
          vz[i] = (float)(dirZ * push);
          spinVel[i] = (float)-rng.Range(9, 14);
          if (!airborne) EnterAir(i);
          break;
        case Reaction.Knockdown:
          vx[i] = (float)(dirX * push * (airborne ? 0.5 : 1));
          vz[i] = (float)(dirZ * push * (airborne ? 0.5 : 1));
          if (airborne) vy[i] = -10;
          else SetState(i, EnemyState.Down);
          break;
      }
      return false;
    }

    void EnterAir(int i)
    {
      SetState(i, EnemyState.Air);
      spin[i] = 0;
      y[i] = (float)Math.Max(y[i], 0.01);
    }

    void SetState(int i, EnemyState s)
    {
      state[i] = s;
      stateTime[i] = 0;
    }

    void Recover(int i) => SetState(i, EnemyState.Idle);

    void Brake(int i, double dt, double lambda)
    {
      vx[i] = (float)CombatMath.Damp(vx[i], 0, lambda, dt);
      vz[i] = (float)CombatMath.Damp(vz[i], 0, lambda, dt);
    }

    int Check(int i)
    {
      if ((uint)i >= (uint)Count) throw new ArgumentOutOfRangeException(nameof(i));
      return i;
    }
  }
}
