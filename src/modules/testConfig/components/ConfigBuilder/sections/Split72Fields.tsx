// Structured editor for the rf_driver.args string in O-RAN 7.2 Split mode.
//
// Amarisoft expresses Split 7.2 fronthaul config as comma-delimited key=value
// pairs in rf_driver.args. Common keys per their documentation:
//
//   if_name           NIC the DU sends fronthaul on (eth0, ens3, ...)
//   vlan_tagging      enable VLAN tagging (0/1)
//   vlan_id           VLAN ID for fronthaul traffic (0–4094)
//   vlan_pcp          PCP / 802.1p priority (0–7)
//   bfp_iq_width      BFP compression bits per IQ (8/9/12/16; 9 typical)
//   c_plane_dst_mac   destination MAC for C-plane (control) frames
//   u_plane_dst_mac   destination MAC for U-plane (user IQ) frames
//   c_plane_port      eCPRI eAxC-ID for control plane
//   u_plane_port      eCPRI eAxC-ID for user plane
//
// rfArgs stays the source-of-truth in form state. The fields below read keys
// out of it via parseRfArgs and write back via setRfArg.
import { Field } from './Field';
import { parseRfArgs, setRfArg } from '../rfDefaults';

interface Props {
  rfArgs: string;
  onChange: (next: string) => void;
}

export function Split72Fields({ rfArgs, onChange }: Props) {
  const args = parseRfArgs(rfArgs);
  const setKey = (key: string, value: string) => onChange(setRfArg(rfArgs, key, value));

  return (
    <div className="space-y-4">
      {/* ─── Fronthaul transport ─────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
          Fronthaul Transport
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            label="Network Interface"
            value={args.if_name || ''}
            onChange={v => setKey('if_name', v)}
            placeholder="eth0"
          />
          <Field
            label="VLAN ID"
            value={args.vlan_id || ''}
            onChange={v => setKey('vlan_id', String(v))}
            type="number" min={0} max={4094}
          />
          <Field
            label="VLAN PCP (priority)"
            value={args.vlan_pcp || ''}
            onChange={v => setKey('vlan_pcp', String(v))}
            type="number" min={0} max={7}
          />
        </div>
      </div>

      {/* ─── Compression ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
          IQ Compression (eCPRI)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="BFP IQ Width (bits)"
            value={args.bfp_iq_width || ''}
            onChange={v => setKey('bfp_iq_width', String(v))}
            type="select"
            options={[
              { value: '8',  label: '8-bit (heavy compression)' },
              { value: '9',  label: '9-bit (typical)' },
              { value: '12', label: '12-bit' },
              { value: '16', label: '16-bit (no compression)' },
            ]}
          />
          <Field
            label="VLAN Tagging"
            value={args.vlan_tagging || ''}
            onChange={v => setKey('vlan_tagging', String(v))}
            type="select"
            options={[
              { value: '1', label: 'Enabled (1)' },
              { value: '0', label: 'Disabled (0)' },
            ]}
          />
        </div>
      </div>

      {/* ─── O-RU MAC addresses ──────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
          O-RU Destination MAC Addresses
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="C-plane Dest MAC"
            value={args.c_plane_dst_mac || ''}
            onChange={v => setKey('c_plane_dst_mac', v)}
            placeholder="aa:bb:cc:dd:ee:ff"
          />
          <Field
            label="U-plane Dest MAC"
            value={args.u_plane_dst_mac || ''}
            onChange={v => setKey('u_plane_dst_mac', v)}
            placeholder="aa:bb:cc:dd:ee:ff"
          />
        </div>
      </div>

      {/* ─── eCPRI port mapping ──────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
          eCPRI Ports (eAxC-ID)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="C-plane Port"
            value={args.c_plane_port || ''}
            onChange={v => setKey('c_plane_port', String(v))}
            type="number" min={0} max={65535}
          />
          <Field
            label="U-plane Port"
            value={args.u_plane_port || ''}
            onChange={v => setKey('u_plane_port', String(v))}
            type="number" min={0} max={65535}
          />
        </div>
      </div>

      {/* ─── Composed args preview (read-only debug) ─────────────────────── */}
      <details className="text-[11px] text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">View composed rf_driver.args</summary>
        <pre className="mt-2 p-2 rounded bg-muted/30 font-mono overflow-x-auto break-all">
          {rfArgs || '(empty)'}
        </pre>
      </details>
    </div>
  );
}
