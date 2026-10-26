import { Settings as SettingsIcon } from 'lucide-react'
import PagePlaceholder from './PagePlaceholder'

function Settings(): React.JSX.Element {
  return (
    <PagePlaceholder
      eyebrow="Make it yours"
      title="Settings"
      description="Your local preferences, data controls, and app information will be available here."
      icon={SettingsIcon}
    />
  )
}

export default Settings
