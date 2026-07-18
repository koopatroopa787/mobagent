import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

typedef AlertCallback    = void Function(Map<String, dynamic> msg);
typedef ProposalCallback = void Function(Map<String, dynamic> msg);

/// Manages the WebSocket connection to the FieldFix daemon (/ws endpoint).
///
/// Owns the approval/rejection half of the protocol (FIX_APPROVAL,
/// FIX_REJECTION). Pairing and the initial connect call are handled by
/// lib/pairing/ (colleague's code), which calls connect() once the
/// PAIR_CONFIRM message is received.
///
/// Wiring in _AppShellState (lib/main.dart):
///   final _socket = DaemonSocket();
///   _socket.onAlert(_onAlert);
///   _socket.onProposal(_onProposal);
///   await _socket.connect('ws://<daemon-ip>:<port>/ws');
class DaemonSocket {
  WebSocketChannel? _channel;
  AlertCallback?    _alertCb;
  ProposalCallback? _proposalCb;

  bool get connected => _channel != null;

  void onAlert(AlertCallback cb)    => _alertCb    = cb;
  void onProposal(ProposalCallback cb) => _proposalCb = cb;

  Future<void> connect(String wsUrl) async {
    _channel = WebSocketChannel.connect(Uri.parse(wsUrl));
    _channel!.stream.listen(
      _dispatch,
      onDone: _onDisconnect,
      onError: _onError,
      cancelOnError: false,
    );
  }

  /// Sends FIX_APPROVAL — called from DiffScreen.onApprove.
  void sendApproval(Map<String, dynamic> proposal) =>
      _send({'type': 'FIX_APPROVAL', ...proposal});

  /// Sends FIX_REJECTION — called from DiffScreen.onReject.
  void sendRejection(String alertId) =>
      _send({'type': 'FIX_REJECTION', 'alert_id': alertId});

  void disconnect() {
    _channel?.sink.close();
    _channel = null;
  }

  void _send(Map<String, dynamic> msg) =>
      _channel?.sink.add(jsonEncode(msg));

  void _dispatch(dynamic raw) {
    final msg = jsonDecode(raw as String) as Map<String, dynamic>;
    switch (msg['type'] as String?) {
      case 'ALERT_NOTIFY':
        _alertCb?.call(msg);
      case 'FIX_PROPOSAL':
        _proposalCb?.call(msg);
      // TEST_RESULT and PUSH_CONFIRM are handled by colleague's pairing/result UI
    }
  }

  void _onDisconnect() {
    _channel = null;
    // TODO lib/pairing/: trigger reconnect or re-pair flow on disconnect
  }

  void _onError(Object err) {
    _channel = null;
    // TODO lib/pairing/: surface connection error to the UI
  }
}
