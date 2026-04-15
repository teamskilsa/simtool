// modules/systems/hooks/use-system-validation.ts
export const validateSystemForm = (data: { 
  type: string; 
  name: string; 
  ip: string; 
}) => {
  if (!data.type) {
    throw new Error('Please select a system type');
  }
  if (!data.name.trim()) {
    throw new Error('Please enter a system name');
  }
  if (!data.ip.trim()) {
    throw new Error('Please enter an IP address');
  }
  
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipPattern.test(data.ip)) {
    throw new Error('Please enter a valid IP address');
  }
  
  const ipParts = data.ip.split('.').map(Number);
  if (ipParts.some(part => part < 0 || part > 255)) {
    throw new Error('IP address numbers must be between 0 and 255');
  }
};
