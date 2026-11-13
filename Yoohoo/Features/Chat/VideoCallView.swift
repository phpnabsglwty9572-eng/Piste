import AVFoundation
import SwiftUI

final class RingbackTone: ObservableObject {
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private var playing = false

    func start() {
        guard playing == false else { return }
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, options: [.mixWithOthers])
        try? session.setActive(true)
        let sampleRate = 44_100.0
        guard let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1) else { return }
        let toneFrames = Int(sampleRate * 1)
        let gapFrames = Int(sampleRate * 2)
        let total = toneFrames + gapFrames
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(total)) else { return }
        buffer.frameLength = AVAudioFrameCount(total)
        let samples = buffer.floatChannelData?[0]
        for index in 0..<toneFrames {
            let time = Double(index) / sampleRate
            let wave = sin(2 * Double.pi * 440 * time) + sin(2 * Double.pi * 480 * time)
            samples?[index] = Float(wave * 0.12)
        }
        if engine.attachedNodes.contains(player) == false {
            engine.attach(player)
            engine.connect(player, to: engine.mainMixerNode, format: format)
        }
        do {
            try engine.start()
        } catch {
            return
        }
        player.scheduleBuffer(buffer, at: nil, options: .loops)
        player.play()
        playing = true
    }

    func stop() {
        guard playing else { return }
        player.stop()
        engine.stop()
        playing = false
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }
}

struct VideoCallView: View {
    var name: String
    @EnvironmentObject private var nav: AppNavigator
    @StateObject private var tone = RingbackTone()

    var body: some View {
        ZStack {
            Image("CallStage")
                .resizable()
                .scaledToFill()
                .ignoresSafeArea()
            Color.black.opacity(0.5).ignoresSafeArea()
            VStack(spacing: 0) {
                Spacer()
                Text(name)
                    .font(YoohooFont.heavy(18))
                    .foregroundStyle(.white)
                Text("Video Call...")
                    .font(YoohooFont.medium(14))
                    .foregroundStyle(.white)
                    .padding(.top, 6)
                Button {
                    tone.stop()
                    nav.pop()
                } label: {
                    Image("CallEnd")
                        .resizable()
                        .frame(width: 55, height: 55)
                }
                .buttonStyle(PressDownStyle())
                .padding(.top, 8)
                .padding(.bottom, 56)
            }
        }
        .background(NavigationGestureRelay())
        .navigationBarHidden(true)
        .onAppear { tone.start() }
        .onDisappear { tone.stop() }
    }
}
