namespace Changshan.Combat
{
  // src/entities/enemies.ts Kind; declaration order and values match the Web.
  public enum EnemyKind : byte { Spear = 0, Sword = 1, Captain = 2 }

  // src/entities/enemies.ts State. E07 ports the reaction states with the Web's values; the AI states (Formation, March,
  // Engage, Windup, Strike, Recover) are E08 and collapse to Idle here: a soldier stands still, and a reaction that ends
  // returns to Idle where the Web returns to Engage or March.
  public enum EnemyState : byte { Idle = 0, Flinch = 6, Air = 7, Knockback = 8, Down = 9, Getup = 10, Dead = 11 }

  public readonly struct Spawn
  {
    public readonly double X, Z, Yaw;
    public readonly EnemyKind Kind;
    public Spawn(double x, double z, double yaw, EnemyKind kind) { X = x; Z = z; Yaw = yaw; Kind = kind; }
  }

  // EnemyStore.KillInfo: where and how fast a soldier was shattered (for fragments), computed from the killing hit.
  public readonly struct KillInfo
  {
    public readonly int Id;
    public readonly double X, Y, Z, Vx, Vy, Vz, Yaw, Spin;
    public readonly EnemyKind Kind;
    public KillInfo(int id, double x, double y, double z, double vx, double vy, double vz, double yaw, double spin, EnemyKind kind)
    {
      Id = id; X = x; Y = y; Z = z; Vx = vx; Vy = vy; Vz = vz; Yaw = yaw; Spin = spin; Kind = kind;
    }
  }

  // EnemyStore.Strike: one enemy attack landing on the player (from the AI in E08; injected for tests and dev until then).
  public readonly struct EnemyStrike
  {
    public readonly double Damage, X, Z;
    public readonly bool Heavy;
    public EnemyStrike(double damage, bool heavy, double x, double z) { Damage = damage; Heavy = heavy; X = x; Z = z; }
  }
}
