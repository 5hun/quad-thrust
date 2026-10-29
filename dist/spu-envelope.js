// ADSR register semantics: https://psx-spx.consoledev.net/soundprocessingunitspu/
// Runs at the SPU's 44,100 Hz clock even when the browser uses 48 kHz.
export class SpuEnvelope {
    adsr1;
    adsr2;
    level = 0;
    counter = 0;
    phase = "attack";
    constructor(adsr1, adsr2) {
        this.adsr1 = adsr1;
        this.adsr2 = adsr2;
    }
    keyOff() {
        if (this.phase !== "off" && this.phase !== "release") {
            this.phase = "release";
            this.counter = 0;
        }
    }
    next() {
        if (this.phase === "off")
            return 0;
        let shift, step, exponential, decreasing;
        if (this.phase === "attack") {
            shift = (this.adsr1 >> 10) & 31;
            step = (this.adsr1 >> 8) & 3;
            exponential = !!(this.adsr1 & 0x8000);
            decreasing = false;
        }
        else if (this.phase === "decay") {
            shift = (this.adsr1 >> 4) & 15;
            step = 0;
            exponential = true;
            decreasing = true;
        }
        else if (this.phase === "sustain") {
            shift = (this.adsr2 >> 8) & 31;
            step = (this.adsr2 >> 6) & 3;
            exponential = !!(this.adsr2 & 0x8000);
            decreasing = !!(this.adsr2 & 0x4000);
        }
        else {
            shift = this.adsr2 & 31;
            step = 0;
            exponential = !!(this.adsr2 & 32);
            decreasing = true;
        }
        let delta = (decreasing ? -8 + step : 7 - step) * 2 ** Math.max(0, 11 - shift);
        let increment = 0x8000 >> Math.max(0, shift - 11);
        if (exponential && !decreasing && this.level > 0x6000) {
            if (shift < 10)
                delta >>= 2;
            else if (shift >= 11)
                increment >>= 2;
            else {
                delta >>= 1;
                increment >>= 1;
            }
        }
        else if (exponential && decreasing)
            delta = (delta * this.level) >> 15;
        const frozen = this.phase === "release" ? shift === 31 : ((shift << 2) | step) === 127;
        if (!frozen)
            increment = Math.max(1, increment);
        this.counter += increment;
        if (this.counter >= 0x8000) {
            this.counter &= 0x7fff;
            this.level = Math.max(0, Math.min(0x7fff, this.level + delta));
            if (this.phase === "attack" && this.level === 0x7fff) {
                this.phase = "decay";
                this.counter = 0;
            }
            else if (this.phase === "decay" &&
                this.level <= ((this.adsr1 & 15) + 1) * 0x800) {
                this.phase = "sustain";
                this.counter = 0;
            }
            else if (this.phase === "release" && this.level === 0)
                this.phase = "off";
        }
        return this.level / 0x8000;
    }
}
if (typeof registerProcessor !== "undefined") {
    class EnvelopeProcessor extends AudioWorkletProcessor {
        envelope;
        offAt = Infinity;
        clock = 0;
        value = 0;
        done = false;
        startAt;
        constructor(options) {
            super();
            const p = options.processorOptions;
            this.envelope = new SpuEnvelope(p.adsr1, p.adsr2);
            this.startAt = p.when;
            this.port.onmessage = (e) => {
                // Disconnecting a node does not retire a processor that returns true.
                // Sources can end naturally before ADSR release, so they explicitly
                // terminate their processor as part of onended cleanup.
                if (e.data.dispose)
                    this.done = true;
                else
                    this.offAt = e.data.when;
            };
        }
        process(inputs, outputs) {
            if (this.done)
                return false;
            const input = inputs[0]?.[0], output = outputs[0][0];
            for (let i = 0; i < output.length; i++) {
                const time = currentTime + i / sampleRate;
                if (time < this.startAt)
                    continue;
                if (time >= this.offAt)
                    this.envelope.keyOff();
                this.clock += 44100 / sampleRate;
                while (this.clock >= 1) {
                    this.value = this.envelope.next();
                    this.clock--;
                }
                output[i] = (input?.[i] || 0) * this.value;
            }
            if (this.envelope.phase === "off" && !this.done) {
                this.done = true;
                this.port.postMessage("ended");
            }
            return !this.done;
        }
    }
    registerProcessor("hover-spu-envelope", EnvelopeProcessor);
}
