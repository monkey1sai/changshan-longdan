namespace Changshan.Combat
{
  public enum PlayerState { Move, Jump, Attack, Musou, Dodge, Guard, Hurt, Down, Dead }

  // World-space intent for one simulation step. Move is 0..1 long; buttons are "pressed this frame".
  public struct PlayerControls
  {
    public double MoveX;
    public double MoveZ;
    public bool Attack;
    public bool Charge;
    public bool Jump;
    public bool Dodge;
    public bool Musou;
    public bool Guard; // held
  }

  public enum PlayerEventType { MoveStart, Swing, Fx, Jump, Land, Dodge, GuardBlock, Parry, MusouStart, Hurt, Death }

  public readonly struct PlayerEvent
  {
    public readonly PlayerEventType Type;
    public readonly MoveId Move; // MoveStart
    public readonly bool Heavy; // Swing, Land, GuardBlock, Hurt
    public readonly HitFx Fx; // Fx
    public readonly double X, Z, Radius; // Fx
    public readonly double Damage; // GuardBlock

    PlayerEvent(PlayerEventType type, MoveId move = default, bool heavy = false, HitFx fx = HitFx.None, double x = 0, double z = 0,
      double radius = 0, double damage = 0)
    {
      Type = type;
      Move = move;
      Heavy = heavy;
      Fx = fx;
      X = x;
      Z = z;
      Radius = radius;
      Damage = damage;
    }

    public static PlayerEvent Simple(PlayerEventType type) => new PlayerEvent(type);
    public static PlayerEvent MoveStarted(MoveId id) => new PlayerEvent(PlayerEventType.MoveStart, move: id);
    public static PlayerEvent WithHeavy(PlayerEventType type, bool heavy) => new PlayerEvent(type, heavy: heavy);
    public static PlayerEvent FxAt(HitFx fx, double x, double z, double radius) => new PlayerEvent(PlayerEventType.Fx, fx: fx, x: x, z: z, radius: radius);
    public static PlayerEvent Blocked(double damage, bool heavy) => new PlayerEvent(PlayerEventType.GuardBlock, heavy: heavy, damage: damage);
  }

  public readonly struct ActiveHit
  {
    public readonly MoveId Move;
    public readonly HitWindow Window;
    public readonly int WindowIndex;
    public readonly uint Stamp;
    public readonly double X, Y, Z, Facing;

    public ActiveHit(MoveId move, HitWindow window, int windowIndex, uint stamp, double x, double y, double z, double facing)
    {
      Move = move;
      Window = window;
      WindowIndex = windowIndex;
      Stamp = stamp;
      X = x;
      Y = y;
      Z = z;
      Facing = facing;
    }
  }

  // Returns a target position near (x, z) within maxDistance, or false when nothing should be auto-aimed.
  public delegate bool AimFunction(double x, double z, double maxDistance, out double targetX, out double targetZ);

  // Issues a new id for every started hit window (src/combat/stamp.ts). One source per simulation, never shared statically.
  public sealed class HitStampSource
  {
    uint counter;

    public uint Next()
    {
      counter = unchecked(counter + 1);
      if (counter == 0) counter = 1;
      return counter;
    }
  }
}
