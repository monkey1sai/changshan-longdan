namespace Changshan.Combat
{
  // src/entities/enemies.ts Kind; declaration order and values match the Web.
  public enum EnemyKind : byte { Spear = 0, Sword = 1, Captain = 2 }

  // src/entities/enemies.ts State with the Web's values. Idle is the Web's Formation (standing, facing the player);
  // March, Engage, Windup, Strike and Recover are the AI (E08); the reaction states are E07.
  public enum EnemyState : byte { Idle = 0, March = 1, Engage = 2, Windup = 3, Strike = 4, Recover = 5, Flinch = 6, Air = 7, Knockback = 8, Down = 9, Getup = 10, Dead = 11 }

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

  // EnemyStore.Strike: one enemy attack landing on the player (from the AI's Strike state, or injected for tests and dev).
  public readonly struct EnemyStrike
  {
    public readonly double Damage, X, Z;
    public readonly bool Heavy;
    public EnemyStrike(double damage, bool heavy, double x, double z) { Damage = damage; Heavy = heavy; X = x; Z = z; }
  }
}
