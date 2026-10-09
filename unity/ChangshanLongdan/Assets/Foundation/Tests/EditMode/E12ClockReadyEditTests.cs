using System;
using System.IO;
using Changshan.Character;
using NUnit.Framework;

namespace Changshan.Foundation.Tests
{
  public sealed class E12ClockReadyEditTests
  {
    [Test] public void EntryRequiresFreshDirectoryAndOneUuid()
    {
      string root = Path.Combine(Path.GetTempPath(), "e12-ready-" + Guid.NewGuid()); Directory.CreateDirectory(root);
      try {
        string[] args = { "-e12ClockReady", root, "-e12RunId", Guid.NewGuid().ToString("D") };
        Assert.IsTrue(E12ClockReady.ParseLaunch(args, out _, out _));
        File.WriteAllText(Path.Combine(root, "existing"), "retain");
        Assert.IsFalse(E12ClockReady.ParseLaunch(args, out _, out _));
      } finally { Directory.Delete(root, true); }
    }
    [Test] public void ConflictingAndMalformedArgumentsFail()
    {
      foreach (string[] args in new[] { Array.Empty<string>(), new[] { "-e12ClockReady" },
        new[] { "-e12ClockReady", "relative", "-e12RunId", "invalid" },
        new[] { "-e12ClockReady", "a", "-e12ClockReady", "b", "-e12RunId", Guid.NewGuid().ToString("D") },
        new[] { "-e12ClockReady", "a", "-e12RunId", Guid.NewGuid().ToString("D"), "-e12Probe", "x" },
        new[] { "-e12ClockReady", "a", "-e12RunId", Guid.NewGuid().ToString("D"), "-e02Output", "x" } })
        Assert.IsFalse(E12ClockReady.ParseLaunch(args, out _, out _));
    }
    [Test] public void FrameBoundaryDoesNotOverrideLoadingFailureOrErrors()
    {
      Assert.IsFalse(E12ClockReady.CanPublish(CharacterLoadStatus.Ready, 119, 0));
      Assert.IsTrue(E12ClockReady.CanPublish(CharacterLoadStatus.Ready, 120, 0));
      Assert.IsFalse(E12ClockReady.CanPublish(CharacterLoadStatus.Ready, 120, 1));
      Assert.IsFalse(E12ClockReady.CanPublish(CharacterLoadStatus.Loading, 120, 0));
      Assert.IsFalse(E12ClockReady.CanPublish(CharacterLoadStatus.Failed, 120, 0));
    }
    [Test] public void AtomicPublicationPreservesExistingEvidence()
    {
      string root = Path.Combine(Path.GetTempPath(), "e12-publish-" + Guid.NewGuid()); Directory.CreateDirectory(root);
      try {
        E12ClockReady.Publish(root, "ready.json", "{\"ready\":true}");
        Assert.AreEqual("{\"ready\":true}", File.ReadAllText(Path.Combine(root, "ready.json")));
        Assert.IsFalse(File.Exists(Path.Combine(root, "ready.json.partial")));
        Assert.Throws<IOException>(() => E12ClockReady.Publish(root, "ready.json", "replacement"));
        Assert.AreEqual("{\"ready\":true}", File.ReadAllText(Path.Combine(root, "ready.json")));
      } finally { Directory.Delete(root, true); }
    }
  }
}
