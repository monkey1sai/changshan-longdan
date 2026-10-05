using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;

namespace Changshan.Character.Editor
{
  // Runs an async glTFast load to completion inside a synchronous editor call; batch-mode -executeMethod has no player loop.
  static class EditorSync
  {
    public static T Run<T>(Func<Task<T>> work, TimeSpan timeout)
    {
      var previous = SynchronizationContext.Current;
      var context = new PumpContext();
      SynchronizationContext.SetSynchronizationContext(context);
      try
      {
        T result = default;
        Exception failure = null;
        context.Post(async _ =>
        {
          try { result = await work(); }
          catch (Exception exception) { failure = exception; }
          finally { context.Complete(); }
        }, null);
        context.Pump(timeout);
        if (failure != null) throw new InvalidOperationException("E03 editor load failed", failure);
        return result;
      }
      finally
      {
        SynchronizationContext.SetSynchronizationContext(previous);
      }
    }

    sealed class PumpContext : SynchronizationContext
    {
      readonly BlockingCollection<(SendOrPostCallback callback, object state)> queue =
        new BlockingCollection<(SendOrPostCallback callback, object state)>();

      public override void Post(SendOrPostCallback callback, object state)
      {
        try { queue.Add((callback, state)); }
        catch (InvalidOperationException) { } // Posted after completion: the awaited work has already finished.
      }

      public override void Send(SendOrPostCallback callback, object state) => throw new NotSupportedException();

      public override SynchronizationContext CreateCopy() => this;

      public void Complete() => queue.CompleteAdding();

      public void Pump(TimeSpan timeout)
      {
        var deadline = DateTime.UtcNow + timeout;
        while (!queue.IsCompleted)
        {
          var remaining = deadline - DateTime.UtcNow;
          if (remaining <= TimeSpan.Zero) throw new TimeoutException("E03 editor load did not finish");
          if (queue.TryTake(out var item, remaining)) item.callback(item.state);
        }
      }
    }
  }
}
