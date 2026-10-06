# API Batch Tools demo

Open **api-batch-simulator.html** in a browser. It works offline and needs no installation or API key.

## Try it

1. Choose a task and click **Generate Proposals**. Try Pause, Resume, Skip, Stop, or changing the request delay.
2. Click **Review Available Results**. Compare original and proposed content. **Accept & Next** saves to the sample bank and advances.
3. Use **Previous** to revisit an accepted question, then **Reject & Restore Original** to undo it. Bulk acceptance and rejection also work.
4. Open **Finish & Retry**, choose retry targets, and run them again. **End Task** keeps accepted sample changes and closes the review.
5. **Save & Exit** stops the run and saves its state. Reopen Batch Tools and choose **Resume Unfinished Work** to continue. Completed proposals and accepted or rejected decisions are kept.

**Start Over**, beside Close, stops the current run and returns to setup. Accepted sample changes stay saved; unaccepted proposals and task undo history are discarded after confirmation. **Cancel** keeps your task. The dialog uses compact panels and a combined question navigator.

**Load review sample** resets the sample bank and opens a prepared review, including one failed response and one unchanged proposal. **Reset demo** restores the original samples and setup screen.

Choose **Rate limit on question 3** to try a scripted error and a five-second demo cooldown. Choose **One failed response** to try a partial failure. Retries succeed after the first scripted failure.

Choose **API usage exhausted on question 3** to try a saved suspension. **Simulate Restored API Access**, then **Resume Unfinished Work**, continues from the unfinished question without generating the first two again. In the actual app, restore API access in Settings or wait for the allowance to reset.

The demo remembers sample decisions in its own browser storage. Reloading an active run keeps completed proposals and marks unfinished questions for retry. It never restarts automatically.

## What it represents

This is a separate walkthrough of the automatic API batch review workflow, using six example questions and three example tasks. AI responses, generation timing, errors, and validation are scripted. It demonstrates saving and undoing decisions in a sample bank; it does not evaluate real AI output, use the app database, or modify the released app.

## QA

124 checks passed: all three task types, accepting and advancing, undo, bulk decisions, selected retries, pause/resume, skip/stop, cooldown, partial failure, finish, close/reopen, saved cancellation, usage exhaustion, explicit resume, reload recovery, restart/cancel in active, paused, stopped, saved, and usage-exhausted tasks, accepted-content preservation after restart, and offline file use. Screen fit was checked at eight sizes from 320 to 1920 pixels wide. No browser errors or external requests were observed.

Detailed results: [demo QA](../docs/API_BATCH_RESTART_QA/demo-results.json).
