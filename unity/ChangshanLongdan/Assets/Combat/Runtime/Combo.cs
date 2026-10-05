namespace Changshan.Combat
{
  public enum ChargeButton { Attack, Charge }

  // Port of src/combat/combo.ts: N1..N6 chain in order, Nk + charge gives C(k+1) up to C6, one aerial JA/JC.
  public static class Combo
  {
    public static MoveId? NextMove(MoveId? current, int normalCount, bool airborne, bool canChain, ChargeButton button)
    {
      if (current == MoveId.MUSOU) return null;
      if (airborne)
      {
        if (current != null) return null;
        return button == ChargeButton.Attack ? MoveId.JA : MoveId.JC;
      }
      if (current == null) return button == ChargeButton.Attack ? MoveId.N1 : MoveId.C1;
      if (!canChain) return null;
      if (current.Value <= MoveId.N6)
      {
        int n = normalCount;
        if (button == ChargeButton.Attack) return n < 6 ? MoveId.N1 + n : (MoveId?)null;
        return n <= 5 ? MoveId.C1 + n : (MoveId?)null;
      }
      // After a charge or aerial move a new string may start.
      return button == ChargeButton.Attack ? MoveId.N1 : MoveId.C1;
    }
  }
}
