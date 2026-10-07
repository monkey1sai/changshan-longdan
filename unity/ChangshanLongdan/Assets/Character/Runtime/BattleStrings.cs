using System;
using System.Globalization;
using Changshan.Combat;
using UnityEngine;

namespace Changshan.Character
{
  // E11: the battle banners from src/ui/i18n.ts and src/presentation.ts. A session override never writes preferences.
  public static class BattleStrings
  {
    public const string LocalePref = "changshan.locale";
    public const string Chinese = "zh-Hant", English = "en";
    static string sessionLocale;

    public static string Locale => sessionLocale ?? Normalise(PlayerPrefs.GetString(LocalePref, Chinese));
    public static string PreferredLocale
    {
      get => Normalise(PlayerPrefs.GetString(LocalePref, Chinese));
      set
      {
        RequireLocale(value);
        PlayerPrefs.SetString(LocalePref, value);
        PlayerPrefs.Save();
        sessionLocale = null;
      }
    }

    public static void SetLocaleForSession(string locale)
    {
      if (locale != null) RequireLocale(locale);
      sessionLocale = locale;
    }

    static string Normalise(string locale) => locale == English ? English : Chinese;
    static void RequireLocale(string locale)
    {
      if (locale != Chinese && locale != English) throw new ArgumentException("LOCALE_UNSUPPORTED", nameof(locale));
    }

    public static string Phase(BattlePhase phase)
    {
      bool en = Locale == English;
      switch (phase)
      {
        case BattlePhase.Opening: return en ? "Wei troops assemble" : "魏軍列陣";
        case BattlePhase.Pressure: return en ? "The enemy advances!" : "敵軍壓上！";
        case BattlePhase.Surge: return en ? "The assault intensifies!" : "攻勢加劇！";
        case BattlePhase.Finale: return en ? "The final encirclement!" : "最後包圍！";
        default: throw new ArgumentOutOfRangeException(nameof(phase));
      }
    }

    public static string Milestone(long ko) => ko.ToString(CultureInfo.InvariantCulture) + (Locale == English ? " KOs!" : " 人斬！");
    public static string HalfDefeated => Locale == English ? "Half the Wei Army Defeated" : "魏軍 半數潰滅";
  }
}
