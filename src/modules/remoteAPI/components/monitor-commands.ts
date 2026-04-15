// src/modules/remoteAPI/config/monitor-commands.ts

export type MonitorCommandType = {
    value: string;
    label: string;
    description: string;
    example?: string;
};

export type MonitorCommandSection = {
    category: string;
    description?: string;
    items: MonitorCommandType[];
};

export const ENB_MONITOR_COMMANDS: MonitorCommandSection[] = [
    {
        category: 'Basic Commands',
        description: 'Essential monitoring commands',
        items: [
            { 
                value: 'help', 
                label: 'Help', 
                description: 'Display the help. Use help <command> for detailed help about a command' 
            },
            { 
                value: 't', 
                label: 'Toggle Basic Trace', 
                description: 'Activate various traces on console. Display stops with return key',
                example: 't [ue|g|cpu|spl] [period]'
            }
        ]
    },
    {
        category: 'Trace Commands',
        description: 'Different types of trace monitoring',
        items: [
            { 
                value: 't ue', 
                label: 'UE Trace', 
                description: 'UE MAC and PRACH traces',
                example: 't ue [ue=<id>] [cell=<id>]'
            },
            { 
                value: 't g', 
                label: 'Global Stats', 
                description: 'Show global eNodeB statistics' 
            },
            { 
                value: 't cpu', 
                label: 'CPU Usage', 
                description: 'Display CPU usage from TRX API and TX-RX latency statistics',
                example: 't cpu [rf_ports=p0[,p1...]]'
            },
            { 
                value: 't spl', 
                label: 'Sample Stats', 
                description: 'Display statistics about sent/received complex samples',
                example: 't spl [rf_ports=p0[,p1...]] [dbm]'
            }
        ]
    },
    {
        category: 'Cell Management',
        description: 'Cell configuration and control commands',
        items: [
            { 
                value: 'cell', 
                label: 'Cell Info', 
                description: 'List available cells with information',
                example: 'cell [main|phy|ntn]'
            },
            { 
                value: 'cell_gain', 
                label: 'Cell Gain', 
                description: 'Set the DL gain of the cell',
                example: 'cell_gain <cell_id> <gain>'
            },
            { 
                value: 'cell_ul_disable', 
                label: 'Disable UL', 
                description: 'Disable uplink of specified cell',
                example: 'cell_ul_disable <cell_id> <flag>'
            },
            {
                value: 'noise_level',
                label: 'Noise Level',
                description: 'Change noise level (requires channel simulator)',
                example: 'noise_level <level> [channel]'
            }
        ]
    },
    {
        category: 'UE Management',
        description: 'UE related operations',
        items: [
            { 
                value: 'ue', 
                label: 'List UEs', 
                description: 'List connected UEs' 
            },
            { 
                value: 'handover', 
                label: 'Handover', 
                description: 'Initiate UE handover to specified cell',
                example: 'handover <RAN_UE_ID> <pci> [arfcn]'
            },
            {
                value: 'rrc_ue_info_req',
                label: 'RRC UE Info',
                description: 'Send RRC UE Information Request',
                example: 'rrc_ue_info_req <UE_ID> <req_mask>'
            },
            {
                value: 'rrc_cnx_release',
                label: 'RRC Release',
                description: 'Force RRC connection release',
                example: 'rrc_cnx_release <UE_ID> [redirect_type]'
            }
        ]
    },
    {
        category: 'Network Interfaces',
        description: 'S1, X2, NG interface management',
        items: [
            { 
                value: 's1', 
                label: 'S1 Status', 
                description: 'Dump the S1 connection state' 
            },
            { 
                value: 's1connect', 
                label: 'S1 Connect', 
                description: 'Force S1 connection to MME',
                example: 's1connect [mme_addr]'
            },
            {
                value: 's1disconnect',
                label: 'S1 Disconnect',
                description: 'Force S1 disconnect from MME'
            },
            { 
                value: 'x2', 
                label: 'X2 Status', 
                description: 'Display X2 connections state' 
            },
            {
                value: 'x2connect',
                label: 'X2 Connect',
                description: 'Force X2 connection to peer',
                example: 'x2connect <peer_addr>'
            },
            {
                value: 'x2disconnect',
                label: 'X2 Disconnect',
                description: 'Force X2 disconnection',
                example: 'x2disconnect <peer_addr>'
            }
        ]
    },
    {
        category: 'Radio Configuration',
        description: 'RF and radio related settings',
        items: [
            { 
                value: 'rf_info', 
                label: 'RF Info', 
                description: 'Get RF driver information' 
            },
            { 
                value: 'tx_gain', 
                label: 'TX Gain', 
                description: 'Set TX gain in dB',
                example: 'tx_gain <gain> [channel]'
            },
            { 
                value: 'rx_gain', 
                label: 'RX Gain', 
                description: 'Set RX gain in dB',
                example: 'rx_gain <gain> [channel]'
            }
        ]
    },
    {
        category: 'Packet Capture',
        description: 'PCAP and monitoring',
        items: [
            {
                value: 'pcap',
                label: 'Start PCAP',
                description: 'Record packet data in PCAP format',
                example: 'pcap [-w filename] [-l data_len] [-b] [-d ms] [-p]'
            },
            {
                value: 'pcap_stop',
                label: 'Stop PCAP',
                description: 'Stop recording PCAP packet data'
            }
        ]
    },
    {
        category: 'Bearer Management',
        description: 'Radio bearer management',
        items: [
            {
                value: 'erab',
                label: 'List ERABs',
                description: 'Show allocated EPS radio bearers',
                example: 'erab [-a]'
            },
            {
                value: 'qos_flow',
                label: 'QoS Flows',
                description: 'Show allocated 5GS QoS flows',
                example: 'qos_flow [-a]'
            },
            {
                value: 'rlc_drop_rate',
                label: 'RLC Drop Rate',
                description: 'Define rate percentage of uplink RLC PDUs dropped',
                example: 'rlc_drop_rate <UE_ID> <rb_id> <rate> [is_srb]'
            }
        ]
    }
];

export const MME_MONITOR_COMMANDS: MonitorCommandSection[] = [
    {
        category: 'Basic Commands',
        description: 'Essential MME monitoring commands',
        items: [
            { 
                value: 'help', 
                label: 'Help', 
                description: 'Display MME monitor help' 
            },
            { 
                value: 't', 
                label: 'Toggle Trace', 
                description: 'Basic MME tracing' 
            },
            { 
                value: 't cpu', 
                label: 'CPU Usage', 
                description: 'Display CPU usage statistics' 
            }
        ]
    }
];

export const UE_MONITOR_COMMANDS: MonitorCommandSection[] = [
    {
        category: 'Basic Commands',
        description: 'Essential UE monitoring commands',
        items: [
            { 
                value: 'help', 
                label: 'Help', 
                description: 'Display UE monitor help' 
            },
            { 
                value: 't', 
                label: 'Toggle Trace', 
                description: 'Basic UE tracing' 
            },
            { 
                value: 't cpu', 
                label: 'CPU Usage', 
                description: 'Display CPU usage statistics' 
            }
        ]
    }
];

// Helper function remains the same
export const getMonitorCommands = (componentType: 'ENB' | 'MME' | 'UE'): MonitorCommandSection[] => {
    switch (componentType) {
        case 'ENB':
            return ENB_MONITOR_COMMANDS;
        case 'MME':
            return MME_MONITOR_COMMANDS;
        case 'UE':
            return UE_MONITOR_COMMANDS;
        default:
            return [];
    }
};