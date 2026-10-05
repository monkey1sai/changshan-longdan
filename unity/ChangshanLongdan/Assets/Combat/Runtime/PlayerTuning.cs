using System;

namespace Changshan.Combat
{
  // Player constants from src/entities/player.ts. Defaults are the Web source values; any other set must declare
  // the same schema version and units, so a profile written for another scale cannot be applied silently.
  public sealed class PlayerTuning
  {
    public const int CurrentSchemaVersion = 1;
    public const string CanonicalUnits = "meters,seconds,radians";

    public static readonly PlayerTuning Default = new PlayerTuning();

    public int SchemaVersion { get; }
    public string Units { get; }
    public double MaxHp { get; }
    public double MusouMax { get; }
    public double RunSpeed { get; }
    public double Gravity { get; }
    public double JumpSpeed { get; }
    public double DodgeSpeed { get; }
    public double DodgeTime { get; }
    public double DashCancelTime { get; }
    public double GuardHalfAngle { get; }
    public double GuardArcCos { get; }
    public double ParryTime { get; }
    public double CounterTime { get; }
    public double InputBuffer { get; } // must cover the longest chain window (N5 cancel 0.36 s)
    public double BodyRadius { get; }
    public double MusouWalkSpeed { get; }

    public PlayerTuning(int schemaVersion = CurrentSchemaVersion, string units = CanonicalUnits, double maxHp = 1000, double musouMax = 100,
      double runSpeed = 7.4, double gravity = 30, double jumpSpeed = 10.5, double dodgeSpeed = 15, double dodgeTime = 0.42,
      double dashCancelTime = 0.1, double guardHalfAngle = Math.PI * 0.36, double parryTime = 0.16, double counterTime = 0.72,
      double inputBuffer = 0.45, double bodyRadius = 0.45, double musouWalkSpeed = 3.2)
    {
      if (schemaVersion != CurrentSchemaVersion)
        throw new ArgumentException($"TUNING_SCHEMA_VERSION: expected {CurrentSchemaVersion}, got {schemaVersion}", nameof(schemaVersion));
      if (units != CanonicalUnits)
        throw new ArgumentException($"TUNING_UNITS: expected '{CanonicalUnits}', got '{units}'", nameof(units));
      Positive(maxHp, nameof(maxHp));
      Positive(musouMax, nameof(musouMax));
      Positive(runSpeed, nameof(runSpeed));
      Positive(gravity, nameof(gravity));
      Positive(jumpSpeed, nameof(jumpSpeed));
      Positive(dodgeSpeed, nameof(dodgeSpeed));
      Positive(dodgeTime, nameof(dodgeTime));
      Positive(dashCancelTime, nameof(dashCancelTime));
      Positive(guardHalfAngle, nameof(guardHalfAngle));
      if (guardHalfAngle >= Math.PI) throw new ArgumentOutOfRangeException(nameof(guardHalfAngle), "TUNING_OUT_OF_RANGE: guard half angle must be below PI");
      Positive(parryTime, nameof(parryTime));
      Positive(counterTime, nameof(counterTime));
      Positive(inputBuffer, nameof(inputBuffer));
      Positive(bodyRadius, nameof(bodyRadius));
      Positive(musouWalkSpeed, nameof(musouWalkSpeed));
      if (dashCancelTime >= dodgeTime) throw new ArgumentOutOfRangeException(nameof(dashCancelTime), "TUNING_OUT_OF_RANGE: dash cancel must precede dodge end");

      SchemaVersion = schemaVersion;
      Units = units;
      MaxHp = maxHp;
      MusouMax = musouMax;
      RunSpeed = runSpeed;
      Gravity = gravity;
      JumpSpeed = jumpSpeed;
      DodgeSpeed = dodgeSpeed;
      DodgeTime = dodgeTime;
      DashCancelTime = dashCancelTime;
      GuardHalfAngle = guardHalfAngle;
      GuardArcCos = Math.Cos(guardHalfAngle);
      ParryTime = parryTime;
      CounterTime = counterTime;
      InputBuffer = inputBuffer;
      BodyRadius = bodyRadius;
      MusouWalkSpeed = musouWalkSpeed;
    }

    static void Positive(double value, string name)
    {
      if (double.IsNaN(value) || double.IsInfinity(value)) throw new ArgumentException($"TUNING_NOT_FINITE: {name}", name);
      if (value <= 0) throw new ArgumentOutOfRangeException(name, $"TUNING_OUT_OF_RANGE: {name} must be positive");
    }
  }
}
