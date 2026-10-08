using System;
using Changshan.Character;
using NUnit.Framework;

namespace Changshan.Foundation.Tests
{
  public sealed class PerformanceTelemetryEditTests
  {
    [Test] public void ProbeAcceptsOnlyTheApprovedAiSeeds()
    {
      foreach (uint seed in new uint[] { 7, 11, 23 })
        Assert.DoesNotThrow(() => PerformanceProbe.RequireControllerSeed(seed));
      foreach (uint seed in new uint[] { 0, 8, uint.MaxValue })
      {
        var error = Assert.Throws<ArgumentOutOfRangeException>(() => PerformanceProbe.RequireControllerSeed(seed));
        StringAssert.Contains("UNSUPPORTED_CONTROLLER_AI_SEED", error.Message);
      }
    }
    static PerformanceProbe.CounterInfo Descriptor(string category, string unit = "Count") =>
      new PerformanceProbe.CounterInfo { name = "Draw Calls Count", category = category, unit = unit };

    [Test] public void RenderCounterSelectionIsIndependentOfCatalogOrder()
    {
      var render = Descriptor("Render");
      var ui = Descriptor("UI Toolkit");
      Assert.AreSame(render, PerformanceProbe.SelectCounterDescriptor(new[] { ui, render }, render.name));
      Assert.AreSame(render, PerformanceProbe.SelectCounterDescriptor(new[] { render, ui }, render.name));
    }

    [Test] public void MissingWrongUnitAndAmbiguousCountersRemainUnknown()
    {
      var render = Descriptor("Render");
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(Array.Empty<PerformanceProbe.CounterInfo>(), render.name));
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(new[] { Descriptor("UI Toolkit") }, render.name));
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(new[] { Descriptor("Render", "Bytes") }, render.name));
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(new[] { render, render }, render.name));
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(new[] { render, Descriptor("Render", "Bytes") }, render.name));
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(new[] { render }, "Unknown"));
    }

    [Test] public void CpuAndMemoryCountersUseTheirOwnCategoryAndUnit()
    {
      var cpu = new PerformanceProbe.CounterInfo { name = "CPU Main Thread Frame Time", category = "Render", unit = "TimeNanoseconds" };
      var memory = new PerformanceProbe.CounterInfo { name = "GC Used Memory", category = "Memory", unit = "Bytes" };
      Assert.AreSame(cpu, PerformanceProbe.SelectCounterDescriptor(new[] { cpu }, cpu.name));
      Assert.AreSame(memory, PerformanceProbe.SelectCounterDescriptor(new[] { memory }, memory.name));
      cpu.unit = "Count";
      memory.category = "Render";
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(new[] { cpu }, cpu.name));
      Assert.IsNull(PerformanceProbe.SelectCounterDescriptor(new[] { memory }, memory.name));
    }
  }
}
